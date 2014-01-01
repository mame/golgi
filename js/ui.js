/**
 * A UI manager.
 * @constructor
 * @param {Golgi.State} state a state manager.
 * @param {Golgi.Navi} navi a navi manager.
 */

var UI = function(state, navi) {
  /* utilities */
  function get(id) {
    return document.getElementById(id);
  }

  function on(obj, type, func) {
    if (typeof obj === 'string') obj = get(obj);
    if (obj.addEventListener) {
      obj.addEventListener(type, func, false);
    }
    else {
      obj.attachEvent(type, func);
    }
  }

  function show(id, html) {
    get(id).innerHTML = html;
  };

  function cancel(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function error(msg) {
    alert('ERROR: ' + msg);
  }

  function auto_scale() {
    need_auto_scale = false;
    var bbox = state.univ.bounding_box();
    if (!isFinite(bbox.w)) {
      bbox.w = bbox.n = -5;
      bbox.e = bbox.s = 5;
    }
    var bbox2 = state.next_univ.bounding_box();
    if (!isFinite(bbox2.w)) {
      bbox2.w = bbox2.n = -5;
      bbox2.e = bbox2.s = 5;
    }
    if (bbox.w > bbox2.w) bbox.w = bbox2.w;
    if (bbox.e < bbox2.e) bbox.e = bbox2.e;
    if (bbox.n > bbox2.n) bbox.n = bbox2.n;
    if (bbox.s < bbox2.s) bbox.s = bbox2.s;
    var w = bbox.e - bbox.w;
    var h = bbox.s - bbox.n;
    var x = (bbox.w + bbox.e) / 2;
    var y = (bbox.n + bbox.s) / 2;
    var w = (bbox.e - bbox.w + 1) * 1.4;
    var h = (bbox.s - bbox.n + 1) * 1.4;
    var cw = canvas.clientWidth;
    var ch = canvas.clientHeight;
    var scale = Math.min(ch / h, cw / w);
    navi.set(x, y, scale);
  }

  function bbox_msg() {
    var bbox = state.univ.bounding_box();
    var msg;
    if (isFinite(bbox.w)) {
      msg = 'W:' + bbox.w + ',E:' + bbox.e + ',N:' + bbox.n + ',S:' + bbox.s;
    }
    else {
      msg = 'N/A';
    }
    return msg;
  }

  function load(id, text) {
    var select = get('examples');
    if (text) {
      window.location.hash = '';
      state.load(text);
      return;
    }
    if (id) {
      id = id.replace('#', '').replace(/_/g, ' ');
      if (Golgi.examples[id]) {
	window.location.hash = '#' + id.replace(/ /g, '_');
	var i;
	for (i = 0; i < select.options.length; i++) {
	  if (select.options[i].value == id) break;
	}
	select.selectedIndex = i;
	state.load(Golgi.examples[id]);
	return;
      }
    }
    var i = Math.floor(select.options.length * Math.random());
    load(select.options[i].value);
  }


  /* properties */
  var canvas = get('canvas');
  var max_grid_num = 30;
  var current_view = null;
  var rectview = new Golgi.RectView(canvas, max_grid_num);
  var cellview = null; /* not initialized */
  var need_auto_scale = false;


  /* commands */
  function cmd_speed_up() {
    state.change_speed(2);
  }

  function cmd_speed_down() {
    state.change_speed(0.5);
  }

  function cmd_backward() {
    state.backward(Number(get('step').value));
  }

  function cmd_forward() {
    state.forward(Number(get('step').value));
  }

  function cmd_toggle_boards() {
    var display = get('check-hide-boards').checked ? 'none' : 'block';
    get('board-status').style.display = display;
    get('board-meta').style.display = display;
    get('board-perf').style.display = display;
    get('board-config-hide').style.display = display;
    get('control').style.display = display;
  }

  function cmd_auto_scale() {
    if (get('check-auto-scale').checked) {
      need_auto_scale = true;
      state.on_univ_changed();
    }
  }

  function cmd_change_view() {
    var cell = get('check-cell-view').checked;

    if (cell && !cellview) {
      /* try to initialize cellview */
      try {
        cellview = new Golgi.CellView(canvas, max_grid_num);
      }
      catch (e) {
        error("Your graphics card and/or browser don't seem to support WebGL.");
        get('check-cell-view').checked = false;
        return;
      }
    }

    /* change the current view */
    if (current_view) current_view.retire();
    current_view = cell ? cellview : rectview;
    current_view.init();

    /* inherit the current color to cell */
    var rgb = document.defaultView.getComputedStyle(get('about-box')).color;
    rectview.set_color(rgb.slice(4, -1));

    /* redraw */
    current_view.resize(window.innerWidth, window.innerHeight);
  }


  /* mouse navigation */
  new function() {
    function pos(e) {
      var scale = navi.scale;
      return {
        x: navi.x + (e.clientX - canvas.clientWidth / 2) / scale,
        y: navi.y + (e.clientY - canvas.clientHeight / 2) / scale
      };
    }

    on('body', 'mousemove', function(e) {
      e.which === 1 ? navi.drag_move(pos(e)) : navi.drag_end();
    });

    on('body', 'mouseup', function(e) {
      cancel(e);
      navi.drag_end();
    });

    on('body', 'mousedown', function(e) {
      window.getSelection().collapse(document.body, 0);
      cancel(e);
      if (e.which === 1) {
        if (!get('check-edit-mode').checked)
          navi.drag_start(pos(e));
        else
          state.write(pos(e));
      }
    });

    function mousewheel(e) {
      var delta = 0;
      if (e.wheelDelta) { // WebKit / Opera / Explorer 9
        delta = e.wheelDelta / 40;
      } else if (e.detail) { // Firefox
        delta = -e.detail / 3;
      }
      if (delta) navi.change_scale(pos(e), Math.pow(2, 1 / delta));
    }
    on('body', 'mousewheel', mousewheel);
    on('body', 'DOMMouseScroll', mousewheel);

    on('canvas', 'touchstart', function(e) {
      e.preventDefault();
      if (!get('check-edit-mode').checked) {
        switch (e.touches.length) {
          case 1:
            navi.drag_start(pos(e.touches[0]));
            break;
          case 2:
            navi.pinch_start(pos(e.touches[0]), pos(e.touches[1]));
            break;
        }
      }
      else {
        state.write(pos(e.touches[0]));
      }
    });

    on('canvas', 'touchend', function(e) {
      e.preventDefault();
      navi.drag_end();
    });

    on('body', 'touchmove', function(e) {
      e.preventDefault();
      switch (e.touches.length) {
        case 1:
          navi.drag_move(pos(e.touches[0]));
          break;
        case 2:
          navi.pinch_move(pos(e.touches[0]), pos(e.touches[1]));
          break;
      }
    });
  };


  /* file load */
  new function() {
    function file_load(files) {
      if (files.length == 1) {
        var reader = new FileReader();
        get('progress').style.display = 'table';
        reader.onload = function(e) {
	  try {
	    load(null, e.target.result);
	  } catch (e) {
	    error('failed to load file: ' + e.toString());
	  }
          get('progress').style.display = 'none';
        };
        reader.readAsText(files[0]);
      }
      else if (files.length > 1) {
        error('cannot load multiple file!');
      }
    }

    var fileapi_available = true;
    fileapi_available = fileapi_available && window.File;
    fileapi_available = fileapi_available && window.FileReader;
    fileapi_available = fileapi_available && window.FileList;
    fileapi_available = fileapi_available && window.Blob;

    if (fileapi_available) {
      on('canvas', 'drop', function(e) {
        cancel(e);
        file_load(e.dataTransfer.files);
      });

      on('canvas', 'dragover', function(e) {
        cancel(e);
        e.dataTransfer.dropEffect = 'copy';
      });
    }

    on('file', 'change', function(e) {
      file_load(e.target.files);
    });
  };


  /* boards */
  new function() {
    on('board-status', 'mousedown', cancel);
    on('board-meta', 'mousedown', function(e) { e.stopPropagation(); });
    on('board-meta', 'mouseup', function(e) { e.stopPropagation(); });
    on('board-perf', 'mousedown', cancel);
    on('board-config', 'mousedown', cancel);
  };


  /* control */
  new function() {
    on('control-body', 'mousedown', cancel);

    on('step', 'mousedown', function(e) { e.stopPropagation(); });
    on('step', 'mouseup', function(e) { e.stopPropagation(); });
  };


  /* buttons */
  new function() {
    on('button-play', 'click', state.play);
    on('button-fast', 'click', cmd_speed_up);
    on('button-slow', 'click', cmd_speed_down);
    on('button-backward', 'click', cmd_backward);
    on('button-forward', 'click', cmd_forward);
    on('button-load', 'click', function(e) {
      get('load').style.display = 'table';
    });
    on('button-reset', 'click', function() { state.reset(); });
    on('button-clear', 'click', function() { state.clear(); });
    on('button-about', 'click', function() {
      get('rule').value = HashLife.get_rule();
      get('about').style.display = 'table';
    });
  };


  /* load */
  new function() {
    on('load', 'mousedown', function() {
      get('load').style.display = 'none';
    });

    on('load-box', 'mousedown', function(e) { e.stopPropagation(); });
    on('load-box', 'mouseup', function(e) { e.stopPropagation(); });

    on('button-file-load', 'click', function(e) {
      get('file').click();
      get('load').style.display = 'none';
    });
  };


  /* about */
  new function() {
    var select = get('examples');
    for (var i in Golgi.examples) {
      var option = document.createElement('option');
      option.value = i;
      option.innerHTML = i;
      select.appendChild(option);
    }

    on('about', 'mousedown', function() {
      get('about').style.display = 'none';
    });

    on('about-box', 'mousedown', function(e) { e.stopPropagation(); });
    on('about-box', 'mouseup', function(e) { e.stopPropagation(); });

    on('examples', 'change', function(e) {
      var i = select.options[select.selectedIndex].value;
      load(i);
      get('about').style.display = 'none';
    });

    on('button-set-rule', 'click', function(e) {
      state.change_rule(get('rule').value);
      get('about').style.display = 'none';
    });

    on('css-list', 'change', function(e) {
      var s = get('css-list');
      var css = s.options[s.selectedIndex].value;
      get('body').className = css;
      cmd_change_view();
    });
  };


  /* config */
  new function() {
    on('check-hide-boards', 'change', cmd_toggle_boards);
    on('check-auto-scale', 'change', cmd_auto_scale);
    on('check-cell-view', 'change', cmd_change_view);
  };


  /* perf */
  var update_fps = null;
  new function() {
    var perf_graph = get('perf-graph');
    while (perf_graph.children.length < 100) {
      var bar = document.createElement('span');
      bar.className = 'perf-graph-bar';
      perf_graph.appendChild(bar);
    }

    var prev_time = Date.now();
    var frames = 0;
    update_fps = function() {
      var time = Date.now();
      frames++;
      if (time > prev_time + 1000) {
        fps = Math.round(frames * 1000 / (time - prev_time));
        show('show-fps', fps);
        var child = perf_graph.appendChild(perf_graph.firstChild);
        child.style.height = Math.min(30, 30 - (fps / 100) * 30) + 'px';
        frames = 0;
        prev_time = time;
      }
    };
  };


  /* window */
  new function() {
    /* resize */
    on(window, 'resize', function() {
      current_view.resize(window.innerWidth, window.innerHeight);
    }, false);

    /* key */
    on(window, 'keydown', function(e) {
      if (e.ctrlKey || e.altKey || e.shiftKey) return;
      switch (e.keyCode) {
        case 13: // return
          state.play();
          break;
        case 32: // space
        case 39: // right
          cmd_forward();
          break;
        case 37: // left
          cmd_backward();
          break;
        case 38: // up
          cmd_speed_up();
          break;
        case 40: // down
          cmd_speed_down();
          break;
        case 65: // a
          get('check-auto-scale').click();
          break;
        case 67: // c
          state.clear();
          break;
        case 69: // e
          get('check-edit-mode').click();
          break;
        case 71: // g
          get('check-show-grid').click();
          break;
        case 79: // o
          get('file').click();
          break;
        case 82: // r
          state.reset();
          break;
        case 86: // v
          get('check-cell-view').click();
          break;
          //default:
          //  console.log(e.keyCode);
      }
    });

    function sight_box() {
      var cw = canvas.clientWidth;
      var ch = canvas.clientHeight;
      var scale = navi.scale;
      var nw = { x: navi.x - cw / scale, y: navi.y - ch / scale };
      var se = { x: navi.x + cw / scale, y: navi.y + ch / scale };
      // must also calculate based on target
      return { w: nw.x, e: se.x, n: nw.y, s: se.y };
    }

    function get_grid_size() {
      if (!get('check-show-grid').checked) return 0;

      var max_coord = Math.max(canvas.clientWidth, canvas.clientHeight);
      var grid_th = max_coord / navi.scale / max_grid_num;
      var grid_size = 1;
      while (grid_size <= grid_th && (grid_size *= 5) <= grid_th)
        grid_size *= 2;
      show('show-grid-size', grid_size);

      return grid_size;
    }

    function tick() {
      document.body.scrollTop = document.body.scrollLeft = 0;
      navi.update();
      state.update();
      current_view.draw(navi, state, sight_box(), get_grid_size());
      update_fps();
      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  };


  /* state change events */
  new function() {
    state.on_speed_changed = function() {
      var v = state.speed;
      if (v < 1) v = '1/' + (1 / v);
      show('show-speed', v);
    };

    state.on_playing_changed = function() {
      var msg = state.playing ? 'playing' : 'pausing';
      get('button-play').className = msg;
    };

    state.on_univ_loaded = function() {
      var meta = state.meta;
      show('show-name', meta && meta.name || 'N/A');
      show('show-author', meta && meta.author || 'N/A');
      var comment = meta && meta.comment ? meta.comment.join('<br />') : 'N/A';
      show('show-comment', comment);
      show('show-rule', HashLife.get_rule());
      need_auto_scale = true;
    };

    state.on_univ_changed = function() {
      show('show-generation', state.univ.get_generation());
      show('show-population', state.univ.get_population());
      show('show-cache-size', HashLife.get_cache_size());
      show('show-bound', bbox_msg());
      show('show-particle-count', current_view.get_particle_count());

      if (need_auto_scale || state.playing && get('check-auto-scale').checked)
        auto_scale();
    };
  };

  /* init */
  new function() {
    cmd_change_view();
    state.change_speed(1);
    load(window.location.hash);
  };
};
