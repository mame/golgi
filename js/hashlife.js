/* A Javascript implementation of HashLife
 * Copyright (C) Yusuke Endoh, 2013
 *
 * Hashlife[1] is a very fast algorithm for computing Conway's Game of Life.
 *
 * [1] Gosper, Bill (1984). "Exploiting Regularities in Large Cellular Spaces".
 *
 * Key points:
 *
 *  - A universe is represented as a purely functional quadtree.
 *  - The `run` function maps each 2^n-size node to any generation (less than
 *    or equal to 2^(n-2)th) of 2^(n-1)-size node whose center is the same as
 *    the original.
 *  - The `run` function is memoized.
 *
 * Usage example:
 *
 *   var univ = HashLife.EmptyUniverse;
 *   univ = univ.load(rle);
 *   univ = univ.run(count);
 *   print(univ.dump());
 */

HashLife = {};
new function() {
  /* An array representing the current birth rule */
  var birth;  /* a cell should live if birth[count] is true */

  /* An array representing the current survival rule */
  var survival;  /* a cell should survive if survival[count] is true */

  /* A bounding box for empty node/leaf */
  var empty_box = { w: Infinity, e: -Infinity, n: Infinity, s: -Infinity };


  /* Each node has the following properties/methods:
   *
   *  - id: the node id
   *  - size: the size of the node
   *  - pop: the population (the number of living cells in the node)
   *  - set: update function for a cell (purely functional)
   *  - get: check function whether a cell is living or not
   *  - dump: dumper (for debug)
   */

  /* Two leaf nodes of quadtree: a dead cell and a live cell. */
  var DeadCell = {
    id: 0, size: 1, pop: 0,
    set: function(x, y, cell) { return cell; },
    get: function(x, y) { return false; },
    dump: function() { return ['.']; },
    each: function(off_x, off_y, query, minsize, blk) { },
    bounding_box: function(x, y) { return empty_box; }
  };
  var LiveCell = {
    id: 1, size: 1, pop: 1,
    set: function(x, y, cell) { return cell; },
    get: function(x, y) { return true; },
    dump: function() { return ['*']; },
    each: function(off_x, off_y, query, minsize, blk) {
      blk(off_x, off_y, 1);
    },
    bounding_box: function(x, y) { return { w: x, e: x, n: y, s: y }; }
  };

  /* A internal node of quadtree */
  var Node = function(nw, ne, sw, se) {
    this.id = _last_id++;
    this.pop = nw.pop + ne.pop + sw.pop + se.pop;
    this.size = nw.size * 2;
    /* four quadrants */
    this.nw = nw;
    this.ne = ne;
    this.sw = sw;
    this.se = se;
    this.offset = this.size / 4;
    /* for garbage collection */
    this.mark_id = -1;
    if (this.size > 4) this.memo = [];
  };


  /* A cache of nodes */
  var _cache = {}, _cache_size = 0;

  /* The sequence number for identifying node objects */
  var _last_id = 2;

  /* A factory method for node */
  function create_node(nw, ne, sw, se) {
    var key = nw.id + ',' + ne.id + ',' + sw.id + ',' + se.id;

    /* return a cached node if any */
    if (_cache[key]) return _cache[key];

    /* create a new node */
    _cache_size++;
    return (_cache[key] = new Node(nw, ne, sw, se));
  }

  /* A factory method for empty node of a given size */
  /* size must be a power to 2 */
  function create_empty_node(size) {
    var n = DeadCell;
    while (size > n.size) n = create_node(n, n, n, n);
    return n;
  }


  /* Updates a cell (in purely functional style) */
  Node.prototype.set = function(x, y, cell) {
    var offset = this.offset;
    if (y < 0) {
      if (x < 0)
        return create_node(
            this.nw.set(x + offset, y + offset, cell),
            this.ne,
            this.sw,
            this.se);
      else
        return create_node(
            this.nw,
            this.ne.set(x - offset, y + offset, cell),
            this.sw,
            this.se);
    }
    else {
      if (x < 0)
        return create_node(
            this.nw,
            this.ne,
            this.sw.set(x + offset, y - offset, cell),
            this.se);
      else
        return create_node(
            this.nw,
            this.ne,
            this.sw,
            this.se.set(x - offset, y - offset, cell));
    }
  };

  /* Checks whether a cell is living or not */
  Node.prototype.get = function(x, y) {
    var offset = this.offset;
    return y < 0 ? x < 0 ? this.nw.get(x + offset, y + offset) :
                           this.ne.get(x - offset, y + offset) :
                   x < 0 ? this.sw.get(x + offset, y - offset) :
                           this.se.get(x - offset, y - offset);
  };

  /* A dumper (for debug) */
  Node.prototype.dump = function() {
    var nw = this.nw.dump();
    var ne = this.ne.dump();
    var sw = this.sw.dump();
    var se = this.se.dump();
    for (var i = 0; i < this.size / 2; i++) {
      nw[i] += ne[i];
      sw[i] += se[i];
    }
    return nw.concat(sw);
  };


  /* Returns a new half-size node */
  Node.prototype.sub_center = function() {
    return create_node(this.nw.se, this.ne.sw, this.sw.ne, this.se.nw);
  };

  Node.prototype.sub_west = function() {
    return create_node(this.nw.sw, this.nw.se, this.sw.nw, this.sw.ne);
  };

  Node.prototype.sub_east = function() {
    return create_node(this.ne.sw, this.ne.se, this.se.nw, this.se.ne);
  };

  Node.prototype.sub_north = function() {
    return create_node(this.nw.ne, this.ne.nw, this.nw.se, this.ne.sw);
  };

  Node.prototype.sub_south = function() {
    return create_node(this.sw.ne, this.se.nw, this.sw.se, this.se.sw);
  };


  /* Runs the simulation (Case: size > 4) */
  function run_step(self, step) {
    /* This function is the main trick of the algorithm.  We write s(w, n, e, s)
     * for a (sub)node of this node where -1 <= w,n,e,s <= 1.  The node itself
     * is written as s(-1, -1, 1, 1).
     * This function returns s(-1/2, -1/2, 1/2, 1/2) after a given step.
     */

    /* let nXY be s((X-2)/2, (Y-2)/2, X/2, Y/2), i.e., each half-size subnode */
    /* e.g., n00 is nw, i.e., s(-1, -1, 0, 0) */
    var n00 = self.nw, n01 = self.sub_north(), n02 = self.ne;
    var n10 = self.sub_west(), n11 = self.sub_center(), n12 = self.sub_east();
    var n20 = self.sw, n21 = self.sub_south(), n22 = self.se;

    var step1 = 0;
    if (self.offset / 2 < step) {
      step1 = self.offset / 2;
      step -= step1;
    }

    /* run each nXY in min(step, offset / 2) */
    /* then, nXY is now s((X-3)/4, (Y-3)/4, (X-1)/4, (Y-1)/4) */
    /* e.g., n00 is s(-3/4, -3/4, -1/4, -1/4) */
    n00 = n00.run(step); n01 = n01.run(step); n02 = n02.run(step);
    n10 = n10.run(step); n11 = n11.run(step); n12 = n12.run(step);
    n20 = n20.run(step); n21 = n21.run(step); n22 = n22.run(step);

    /* merge each four nXYs and run each in the remaining steps */
    /* e.g., merging n00, n01, n10, and n11 yields s(-3/4, -3/4, 1/4, 1/4),
     * and running it yields s(-1/2, -1/2, 0, 0).
     */
    return create_node(
        create_node(n00, n01, n10, n11).run(step1),
        create_node(n01, n02, n11, n12).run(step1),
        create_node(n10, n11, n20, n21).run(step1),
        create_node(n11, n12, n21, n22).run(step1));
  }

  /* Calculates the next state under the rule of Game of Life */
  function apply_rule(bits) {
    var living = (bits >> 5) & 1;
    var count = 0;

    /* count the living cells in the Moore neighborhood */
    bits &= 0x757;
    while (bits !== 0) {
      count += 1;
      bits &= bits - 1;
    }

    /* birth */
    if (living) return survival[count] ? LiveCell : DeadCell;
    return birth[count] ? LiveCell : DeadCell;
  }

  var ccc = 0;

  /* Runs the simulation (Case: size == 4) */
  function run_base(self) {
    var bits = 0;
    for (var y = -2; y < 2; y++) {
      for (var x = -2; x < 2; x++) {
        bits = (bits << 1) | (self.get(x, y) ? 1 : 0);
      }
    }
    return create_node(
        apply_rule(bits >> 5),
        apply_rule(bits >> 4),
        apply_rule(bits >> 1),
        apply_rule(bits));
  }

  /* Runs the simulation in a given step (0 <= step <= 2^(size-2)) */
  Node.prototype.run = function(step) {
    /* two trivial cases */
    if (this.pop === 0) return this.nw;
    if (step === 0) return this.sub_center();

    if (this.size === 4) {
      if (this.memo) return this.memo;
      this.memo = run_base(this);
      return this.memo;
    }

    var memo = this.memo[step];
    if (memo) return memo;
    return (this.memo[step] = run_step(this, step));
  };


  /* Expands a node with empty sub node */
  Node.prototype.expand = function(step) {
    if (this.size >= 8 && this.offset >= step &&
        this.nw.pop === this.nw.se.se.pop &&
        this.ne.pop === this.ne.sw.sw.pop &&
        this.sw.pop === this.sw.ne.ne.pop &&
        this.se.pop === this.se.nw.nw.pop)
      return this;

    var n = create_empty_node(this.size / 2);
    return create_node(
        create_node(n, n, n, this.nw),
        create_node(n, n, this.ne, n),
        create_node(n, this.sw, n, n),
        create_node(this.se, n, n, n)).expand(step);
  };

  /* Shrink a node if three quadrants are empty */
  Node.prototype.shrink = function(x, y) {
    if (this.size <= 8) return { off_x: x, off_y: y, node: this };

    var pop = this.pop, offset = this.offset;

    if (pop === this.nw.pop) return this.nw.shrink(x - offset, y - offset);
    if (pop === this.ne.pop) return this.ne.shrink(x + offset, y - offset);
    if (pop === this.sw.pop) return this.sw.shrink(x - offset, y + offset);
    if (pop === this.se.pop) return this.se.shrink(x + offset, y + offset);

    var sub = this.sub_center();
    if (pop === sub.pop) return sub.shrink(x, y);
    sub = this.sub_west();
    if (pop === sub.pop) return sub.shrink(x - offset, y);
    sub = this.sub_east();
    if (pop === sub.pop) return sub.shrink(x + offset, y);
    sub = this.sub_north();
    if (pop === sub.pop) return sub.shrink(x, y - offset);
    sub = this.sub_south();
    if (pop === sub.pop) return sub.shrink(x, y + offset);

    return { off_x: x, off_y: y, node: this };
  };


  /* Enumerates all living cells */
  Node.prototype.each = function(off_x, off_y, query, minsize, blk) {
    if (this.pop === 0) return;
    var offset = this.offset;
    var size = this.size;
    if (size <= minsize) {
      blk(off_x, off_y, this.pop / (size * size));
    }
    else {
      if (query.n < off_y) {
        if (query.w < off_x)
          this.nw.each(off_x - offset, off_y - offset, query, minsize, blk);
        if (off_x <= query.e)
          this.ne.each(off_x + offset, off_y - offset, query, minsize, blk);
      }
      if (off_y <= query.s) {
        if (query.w < off_x)
          this.sw.each(off_x - offset, off_y + offset, query, minsize, blk);
        if (off_x <= query.e)
          this.se.each(off_x + offset, off_y + offset, query, minsize, blk);
      }
    }
  };

  /* Calculates the minimum bounding box for all living cells */
  Node.prototype.bounding_box = function(x, y) {
    if (this.pop === 0) return empty_box;
    var offset = this.offset;
    var nw = this.nw, ne = this.ne, sw = this.sw, se = this.se;
    nw = nw.bounding_box(x - offset, y - offset);
    ne = ne.bounding_box(x + offset, y - offset);
    sw = sw.bounding_box(x - offset, y + offset);
    se = se.bounding_box(x + offset, y + offset);
    return {
      w: Math.min(nw.w, ne.w, sw.w, se.w),
      e: Math.max(nw.e, ne.e, sw.e, se.e),
      n: Math.min(nw.n, ne.n, sw.n, se.n),
      s: Math.max(nw.s, ne.s, sw.s, se.s) };
  };


  /* Each universe for cells has the following properties:
   *
   *  - root: Node
   *  - attr.off_x/off_y: the center point of root (from origin)
   *  - attr.gen_count: the generation count
   *  - attr.prev: the previous universe
   */
  var Universe = function(root, attr) {
    this.root = root;
    this.attr = attr;
  };

  /* Updates a cell (in purely functional style) */
  Universe.prototype.set = function(x, y, alive) {
    x -= this.attr.off_x;
    y -= this.attr.off_y;
    var size = Math.max(Math.abs(x), Math.abs(y));
    var root = this.root.expand(size).set(x, y, alive ? LiveCell : DeadCell);
    var attr = { off_x: this.attr.off_x, off_y: this.attr.off_y, gen_count: 0 };
    return new Universe(root, attr);
  };

  /* Checks whether a cell is living or not */
  Universe.prototype.get = function(x, y) {
    var bound = this.root.offset * 2;
    x -= this.attr.off_x;
    y -= this.attr.off_y;
    if (x < -bound || bound <= x) return false;
    if (y < -bound || bound <= y) return false;
    return this.root.get(x, y);
  };

  /* A dumper (for debug) */
  Universe.prototype.dump = function() {
    return this.root.dump().join('\n');
  };

  var Window = 4;
  var Log2 = Math.log(2);
  function each_key_frame(n, blk) {
    var exp = Math.floor(Math.log((n + Window - 1) / Window) / Log2);
    var off = n + Window - 1 - Window * Math.pow(2, exp);
    var step = 1;
    for (; exp; exp--) {
      for (var i = Window - 1 + (off % 2); i; i--, n -= step) blk(n);
      off = Math.floor(off / 2);
      step *= 2;
    }
    for (off += 2; off; off--, n -= step) blk(n);
  }

  /* Runs the simulation in a given step */
  Universe.prototype.run = function(step) {
    if (this.root.pop === 0) return this;
    var r = this.root.expand(step);
    r = r.run(step);
    r = r.shrink(this.attr.off_x, this.attr.off_y);
    var attr = {
      off_x: r.off_x, off_y: r.off_y,
      gen_count: this.attr.gen_count + step,
      prev: this
    };

    r = new Universe(r.node, attr);

    if (attr.gen_count) {
      var n = r;
      each_key_frame(attr.gen_count, function(count) {
        if (count === 0) return;
        var prev = n.attr.prev;
        while (true) {
          if (!prev) break;
          if (!prev.attr.prev) break;
          if (prev.attr.prev.attr.gen_count < count) break;
          n.attr.prev = prev = prev.attr.prev;
        }
        if (prev && prev.attr.gen_count >= count) n = prev;
      });
    }

    return r;
  };

  /* Runs backward in a given step */
  Universe.prototype.run_back = function(step) {
    var gen_count = this.attr.gen_count - step;
    var univ = this;
    if (gen_count < 0) throw 'cannot go back any more';
    while (univ.attr.gen_count > gen_count) {
      univ = univ.attr.prev;
    }
    return univ.run(gen_count - univ.attr.gen_count);
  };

  /* Returns the current generation */
  Universe.prototype.get_generation = function() {
    return this.attr.gen_count;
  };

  /* Returns the current population */
  Universe.prototype.get_population = function() {
    return this.root.pop;
  };

  /* Enumerates all living cells */
  Universe.prototype.each = function(blk) {
    this.query({}, 0, blk);
  };

  /* Enumerates all living cells in query region */
  Universe.prototype.query = function(query, minsize, blk) {
    query = {
      w: query.w || -Infinity,
      e: query.e || Infinity,
      n: query.n || -Infinity,
      s: query.s || Infinity
    };
    this.root.each(this.attr.off_x, this.attr.off_y, query, minsize, blk);
  };

  /* Calculates the minimum bounding box for all living cells */
  Universe.prototype.bounding_box = function() {
    var bbox = this.root.bounding_box(this.attr.off_x, this.attr.off_y);
    return {
      w: bbox.w - 0.5, e: bbox.e + 0.5,
      n: bbox.n - 0.5, s: bbox.s + 0.5
    };
  };

  /* Returns all living moore neighbors (including the center cell) */
  Universe.prototype.moore = function(x, y) {
    var i, j, a = [];
    for (j = -1; j <= 1; j++) {
      for (i = -1; i <= 1; i++) {
        if (this.get(x + i, y + j)) a.push({ x: i, y: j });
      }
    }
    return a;
  };


  /* Returns the current rule description */
  HashLife.get_rule = function() {
    var i = 0, s = 'B';
    for (i in birth) {
      if (birth[i]) s = s + i;
    }
    s = s + '/S';
    for (i in survival) {
      if (survival[i]) s = s + i;
    }
    return s;
  };


  /* Updates the rule */
  HashLife.change_rule = function(rule) {
    var _re_rule = new RegExp(
        '^(?:B(\\d+)/S(\\d+)|S(\\d+)/B(\\d+)|(\\d+)/(\\d+))$', 'i');
    var r;
    if ((r = _re_rule.exec(rule)) === null)
      throw ('unknown rule format: ' + rule);

    var _birth = r[1] || r[4] || r[6];
    var _survival = r[2] || r[3] || r[5];

    r = 'B' + _birth + '/S' + _survival;
    if (r == HashLife.get_rule()) return;

    function make_table(rule) {
      var i, table = [];
      for (i = 0; i < rule.length; i++) table[Number(rule[i])] = true;
      for (i = 0; i < table.length; i++) table[i] = table[i] || false;
      return table;
    }

    birth = make_table(_birth);
    survival = make_table(_survival);

    /* clear cache */
    _last_id = 2;
    _cache = {};
    _cache_size = 0;

    /* A universe that has no cell */
    HashLife.EmptyUniverse = new Universe(
        create_empty_node(8),
        { off_x: 0, off_y: 0, gen_count: 0, prev: null },
        null);
  };

  /* Sets the default rule is B3/S23 */
  HashLife.change_rule('B3/S23');


  /* Regexps for parsing rle format */
  var _re_rle = new RegExp(
      '\\s*(?:' +                 // skip spaces
      '#(.)\\s*(.*)|' +           // comment line
      '(x.*)\\r?\\n|' +           // header line
      '([\\d\\s]*)([bo\\$!])|' +  // chunk
      '\\r|\\n' +                 // skip newline
      ')', 'g');
  var _re_space = new RegExp('\\s', 'g');
  var _re_header = new RegExp('rule=(.*)', 'i');

  /* A parser for rle format */
  HashLife.load = function(pattern) {
    var univ = null, r, x = 0, y = 0, stop = false;
    var last_index = 0;
    var name, author, comment = [];
    _re_rle.lastIndex = last_index;
    while (!stop && (r = _re_rle.exec(pattern)) !== null) {
      if (r.index !== last_index) break;
      last_index = _re_rle.lastIndex;
      if (r[1]) {
        switch (r[1]) {
          case 'N':
            name = r[2];
            break;
          case 'O':
            author = r[2];
            break;
          case 'C':
            comment.push(r[2]);
            break;
        }
      }
      else if (r[3]) {
        var attrs = r[3].replace(_re_space, '').split(',');
        for (var i in attrs) {
          var attr = attrs[i].split('=');
          if (attr[0] == 'rule') {
            HashLife.change_rule(attr[1]);
            univ = HashLife.EmptyUniverse;
          }
        }
      }
      else if (r[5]) {
        if (!univ) {
          HashLife.change_rule('B3/S23');
          univ = HashLife.EmptyUniverse;
        }
        var len = Number(r[4].replace(_re_space, ''));
        if (!len) len = 1;
        switch (r[5]) {
          case 'b': case 'o':
            if (r[5] === 'o') {
              for (var i = 0; i < len; i++) univ = univ.set(x++, y, true);
            }
            else {
              x += len;
            }
            break;
          case '$':
            x = 0;
            y += len;
            break;
          case '!':
            stop = true;
            break;
        }
      }
    }
    if (!stop) throw ('unknown format: ' + pattern.substr(last_index, 10));
    var r = univ.root.shrink(univ.attr.off_x, univ.attr.off_y);
    var attr = { off_x: r.off_x, off_y: r.off_y, gen_count: 0, prev: null };
    var univ = new Universe(r.node, attr);
    var meta = { name: name, author: author, comment: comment };
    return { univ: univ, meta: meta };
  };


  /* Marks a node (for a garbage collection) */
  Node.prototype.mark = function(mark_id) {
    if (this.mark_id === mark_id) return;
    this.mark_id = mark_id;
    this.check = 0;
    if (this.offset >= 1) {
      this.nw.mark(mark_id);
      this.ne.mark(mark_id);
      this.sw.mark(mark_id);
      this.se.mark(mark_id);
    }
    if (this.size === 4) {
      if (this.memo) this.memo.mark(mark_id);
    }
    else {
      var memo = this.memo;
      for (var i in memo) memo[i].mark(mark_id);
    }
  };

  /* Marks a universe */
  Universe.prototype.mark = function(mark_id) {
    this.root.mark(mark_id);
    if (this.attr.prev) this.attr.prev.mark(mark_id);
  };

  var _mark_id = 0;
  /* A garbage collection with mark and sweep */
  HashLife.gc = function(universes) {
    _mark_id++;

    /* marking phase */
    HashLife.EmptyUniverse.mark(_mark_id);
    for (var i in universes) universes[i].mark(_mark_id);

    /* sweeping phase */
    for (var key in _cache) {
      if (_cache[key].mark_id !== _mark_id) {
        delete _cache[key];
        _cache_size--;
      }
    }
  };

  /* Returns the cache size */
  HashLife.get_cache_size = function() {
    return _cache_size;
  };
}
