/**
 * A navigation manager.
 * @constructor
 * @param {Number} x initial center point.
 * @param {Number} y initial center point.
 * @param {Number} scale initial scale.
 * @param {Number} dumping_factor dumping factor.
 */

Golgi.Navi = function(x, y, scale, dumping_factor) {
  var self = this;

  self.x = x || 0;
  self.y = y || 0;
  self.scale = scale || 40;

  var DUMPING_FACTOR = dumping_factor || 0.9;

  var drag_pos = { x: 0, y: 0 };
  var prev_drag_pos = null;
  var move_velocity = { x: 0, y: 0 };
  var pinch_dist = 0;
  var zoom_pos = { x: 0, y: 0 };
  var scale_variation = 1.0;


  /* drag */
  self.drag_start = function(pos) {
    drag_pos = prev_drag_pos = pos;
  };

  self.drag_move = function(pos) {
    drag_pos = pos;
  };

  self.drag_end = function() {
    prev_drag_pos = null;
  };

  function do_drag() {
    if (prev_drag_pos) {
      move_velocity = {
        x: drag_pos.x - prev_drag_pos.x,
        y: drag_pos.y - prev_drag_pos.y
      };
      prev_drag_pos = drag_pos;
    }
    self.x -= move_velocity.x;
    self.y -= move_velocity.y;
    drag_pos.x -= move_velocity.x;
    drag_pos.y -= move_velocity.y;
    zoom_pos.x -= move_velocity.x;
    zoom_pos.y -= move_velocity.y;
    move_velocity.x *= DUMPING_FACTOR;
    move_velocity.y *= DUMPING_FACTOR;
  }


  /* zoom (wheel / pinch) */
  self.change_scale = function(pos, delta) {
    zoom_pos = pos;
    scale_variation *= Math.pow(delta, 1 - DUMPING_FACTOR);
  };

  function hypot(pos1, pos2) {
    var x = pos2.x - pos1.x;
    var y = pos2.y - pos1.y;
    return Math.sqrt(x * x + y * y);
  }

  self.pinch_start = function(pos1, pos2) {
    pinch_dist = hypot(pos1, pos2);
  };

  self.pinch_move = function(pos1, pos2) {
    var dist = hypot(pos1, pos2);
    var pos = { x: (pos1.x + pos2.x) / 2, y: (pos1.y + pos2.y) / 2 };
    self.change_scale(pos, Math.pow(dist / pinch_dist, 2));
    pinch_dist = dist;
  };

  function do_zoom() {
    self.x = (self.x - zoom_pos.x) / scale_variation + zoom_pos.x;
    self.y = (self.y - zoom_pos.y) / scale_variation + zoom_pos.y;
    self.scale *= scale_variation;
    scale_variation = Math.pow(scale_variation, DUMPING_FACTOR);
  }


  self.update = function(step) {
    do_drag();
    do_zoom();
  };

  self.set = function(x, y, scale) {
    move_velocity = {
      x: (self.x - x) * (1 - DUMPING_FACTOR),
      y: (self.y - y) * (1 - DUMPING_FACTOR)
    };
    zoom_pos = { x: self.x, y: self.y };
    scale_variation = Math.pow(scale / self.scale, 1 - DUMPING_FACTOR);
  };
};
