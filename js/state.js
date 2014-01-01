/**
 * A state manager.
 * @constructor
 */

Golgi.State = function() {
  var self = this;

  self.playing = false;
  self.speed = 1 / 16;
  self.tick = 0;
  self.univ = HashLife.EmptyUniverse;
  self.next_univ = self.univ;
  self.meta = {};
  self.need_update = false;

  function pause() {
    self.playing = false;
    self.on_playing_changed();
  }

  function load_univ(univ) {
    self.tick = self.speed;
    self.next_univ = univ;
    self.on_univ_loaded();
    pause();
  }

  function update_univ(univ) {
    self.tick = self.speed;
    self.next_univ = univ;
    self.need_update = true;
    self.on_univ_changed();
  }

  function play() {
    self.playing = true;
    update_univ(self.univ.run(Math.ceil(self.speed)));
    self.on_playing_changed();
  }

  self.write = function(pos) {
    self.meta = {};
    var s = self.univ.get(pos.x, pos.y);
    load_univ(self.univ.set(pos.x, pos.y, !s));
  };

  self.load = function(rle) {
    var r = HashLife.load(rle);
    self.meta = r.meta;
    self.on_univ_loaded();
    load_univ(r.univ);
  };

  self.change_rule = function(rule) {
    var cells = {}, cell, univ, x, y;
    self.univ.each(function(x, y) { cells[x + ',' + y] = true; });
    try {
      HashLife.change_rule(rule);
      univ = HashLife.EmptyUniverse;
      for (cell in cells) {
        cell = cell.split(',');
        univ = univ.set(Number(cell[0]), Number(cell[1]), true);
      }
      load_univ(univ);
    }
    catch (e) {
      alert('illegal rule denotation; it should be like \"B3/S23\".');
    }
  };

  self.reset = function() {
    pause();
    update_univ(self.univ.run_back(self.univ.get_generation()));
  };

  self.clear = function() {
    pause();
    self.load('!');
  };

  self.change_speed = function(mult) {
    self.speed *= mult;
    self.on_speed_changed();
  };

  self.play = function() {
    self.playing ? pause() : play();
  };

  self.backward = function(step) {
    if (self.playing) {
      pause();
      if (self.tick === 0) {
        update_univ(self.univ);
      }
      else {
        var univ = self.univ;
        self.tick = 1 - self.tick;
        self.univ = self.next_univ;
        update_univ(univ);
      }
    }
    else if (self.tick === 0) {
      var gen = self.univ.get_generation();
      if (gen === 0) {
        alert('You can no longer go back!');
      }
      else {
        if (gen < step) step = gen;
        update_univ(self.univ.run_back(step));
      }
    }
  };

  self.forward = function(step) {
    if (self.playing) {
      pause();
    }
    else if (self.tick === 0) {
      update_univ(self.univ.run(step));
    }
  };

  self.update = function() {
    if (self.playing || self.tick) {
      self.tick += self.speed;
      if (self.tick >= 1) {
        self.tick = 0;
        self.univ = self.next_univ;
        if (self.playing) {
          update_univ(self.univ.run(Math.ceil(self.speed)));
        }
        else {
          self.need_update = true;
          self.on_univ_changed();
        }
      }
    }
  };
};
