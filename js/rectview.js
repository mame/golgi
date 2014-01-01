/**
 * A canvas-based viewer
 * @constructor
 * @param {Node} dom A dom node of a wrapper div.
 * @param {Number} max_grid_num A maximun number of grid lines.
 */

Golgi.RectView = function(dom, max_grid_num) {
  var canvas = document.createElement('canvas');
  dom.style.backgroundColor = '#000000';
  var ctx = canvas.getContext('2d');

  function draw_grid(l, r, t, b, nscale, grid_size) {
    /* grid */
    ctx.beginPath();
    ctx.lineWidth = 1.5 / nscale;
    ctx.strokeStyle = 'rgb(64,64,64)';
    for (x = l; x <= r; x += grid_size) {
      ctx.moveTo(x, t);
      ctx.lineTo(x, b);
    }
    for (y = t; y <= b; y += grid_size) {
      ctx.moveTo(l, y);
      ctx.lineTo(r, y);
    }
    ctx.stroke();

    /* x/y axises */
    ctx.beginPath();
    ctx.lineWidth = 3 / nscale;
    ctx.strokeStyle = 'rgb(255,255,255)';
    ctx.moveTo(0, t);
    ctx.lineTo(0, b);
    ctx.moveTo(l, 0);
    ctx.lineTo(r, 0);
    ctx.stroke();
  }

  var color;

  function draw_cells(nscale, state, sight) {
    var limit = 1;
    while (limit * nscale < 1) limit *= 2;

    ctx.transform(1, 0, 0, 1, -limit / 2, -limit / 2);

    var k = state.tick;
    state.next_univ.query(sight, limit, function(x, y, density) {
      ctx.fillStyle = color(density * k);
      ctx.fillRect(x, y, limit, limit);
    });

    k = 1 - k;
    state.univ.query(sight, limit, function(x, y, density) {
      ctx.fillStyle = color(density * k);
      ctx.fillRect(x, y, limit, limit);
    });
  }

  this.init = function() {
    dom.appendChild(canvas);
  };

  this.retire = function() {
    dom.removeChild(canvas);
  };

  this.resize = function(width, height) {
    canvas.width = width;
    canvas.height = height;
  };

  this.draw = function(navi, state, sight, grid_size) {
    var nscale = navi.scale;

    var w = canvas.width / nscale;
    var h = canvas.height / nscale;
    ctx.setTransform(nscale, 0, 0, nscale,
        (w / 2 - navi.x) * nscale,
        (h / 2 - navi.y) * nscale);

    /* clear all */
    ctx.clearRect(navi.x - w / 2, navi.y - h / 2, w, h);

    if (grid_size || true) {
      var x = (navi.x - w / 2) / grid_size;
      var y = (navi.y - h / 2) / grid_size;
      var l = Math.floor(x) * grid_size;
      var r = Math.ceil(x) * grid_size + w;
      var t = Math.floor(y) * grid_size;
      var b = Math.ceil(y) * grid_size + h;
      draw_grid(l, r, t, b, nscale, grid_size);
    }

    draw_cells(nscale, state, sight);
  };

  this.set_color = function(s) {
    s = 'rgba(' + s + ',';
    color = function(a) {
      return s + a + ')';
    };
  };

  this.get_particle_count = function() {
    return 'N/A';
  };
};
