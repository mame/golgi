/**
 * A webgl-based cellular viewer
 * @constructor
 * @param {Node} dom A dom node of a wrapper div.
 * @param {Number} max_grid_num A maximun number of grid lines.
 */

Golgi.CellView = function(dom, max_grid_num) {
  var webgl_available = (function() {
    try {
      return window.WebGLRenderingContext &&
             document.createElement('canvas').getContext('experimental-webgl');
    }
    catch (e) {
      return false;
    }
  })();
  if (!webgl_available) throw ('WebGL not avaiable');

  var renderer, camera;
  var scene1, particles = null, uniforms, attributes;
  var scene2, texture, plane, grid, cross;

  function create_particles(count) {
    uniforms = {
      time: { type: 'f', value: 0.0 },
      scale: { type: 'f', value: 1 },
      size: { type: 'f', value: 1 },
      origin: { type: 'v2', value: new THREE.Vector2(0, 0) }
    };
    attributes = {
      src: { type: 'v3', value: [] },
      dst: { type: 'v3', value: [] }
    };

    var geom = new THREE.Geometry();

    for (var j = 0; j < count; j++) {
      var uvs = [];
      for (var i = 0; i < 4; i++) {
        var x = Math.floor((i + 1) / 2) % 2, y = Math.floor(i / 2);
        geom.vertices.push(new THREE.Vector3(x - 0.5, y - 0.5, 0));
        uvs.push(new THREE.Vector2(x, y));
        attributes.src.value.push(new THREE.Vector3(0, 0, 0));
        attributes.dst.value.push(new THREE.Vector3(0, 0, 0));
      }
      geom.faces.push(new THREE.Face3(j * 4, j * 4 + 1, j * 4 + 2));
      geom.faces.push(new THREE.Face3(j * 4, j * 4 + 2, j * 4 + 3));
      geom.faceVertexUvs[0].push([uvs[0], uvs[1], uvs[2]]);
      geom.faceVertexUvs[0].push([uvs[0], uvs[2], uvs[3]]);
    }

    particles = new THREE.Mesh(geom, new THREE.ShaderMaterial({
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
      uniforms: uniforms, attributes: attributes,
      vertexShader: Golgi.CellView.vert_pass_1,
      fragmentShader: Golgi.CellView.frag_pass_1
    }));
    scene1.add(particles);
  }

  function delete_particles() {
    particles.geometry.dispose();
    particles.material.dispose();
    scene1.remove(particles);
  }

  function ensure_particles(count) {
    var c = particles ? particles.geometry.faces.length / 2 : 1;
    if (c >= count) {
      attributes.src.needsUpdate = attributes.dst.needsUpdate = true;
      return;
    }
    while (c < count) c *= 2;

    if (particles) delete_particles();
    create_particles(c);
  }

  function make_particles(univ1, univ2, bbox, limit, blk) {
    univ1.query(bbox, limit, function(x, y, density) {
      if (limit > 1) return blk(x, y, 1, x, y, 1, density);
      var m = univ2.moore(x, y);
      for (var i in m) {
        var v = m[i], x2 = x + v.x, y2 = y + v.y;
        blk(x, y, 1 / m.length, x2, y2, 1 / univ1.moore(x2, y2).length, 1);
      }
      if (m.length === 0) blk(x, y, 1, x, y, 0, 1);
    });
    if (limit === 1)
      univ2.query(bbox, limit, function(x, y, density) {
        if (univ1.moore(x, y).length === 0) blk(x, y, 0, x, y, 1, 1);
      });
  }

  function set_particles(navi, state, sight) {
    var c = 0, i = 0, j;
    var limit = 1;
    while (limit * navi.scale < 2) limit *= 2;

    var nuniv = state.next_univ;
    make_particles(state.univ, nuniv, sight, limit, function() { c++; });
    ensure_particles(c);
    uniforms.size.value = limit < 1 ? 3 : limit * 3;
    make_particles(state.univ, nuniv, sight, limit,
        function(sx, sy, sp, dx, dy, dp, p) {
          for (j = 0; j < 4; i++, j++) {
            attributes.src.value[i].set(sx, -sy, sp * p);
            attributes.dst.value[i].set(dx, -dy, dp * p);
          }
        });
    for (; i < particles.geometry.faces.length * 2; i++) {
      attributes.src.value[i].set(0, 0, 0);
      attributes.dst.value[i].set(0, 0, 0);
    }
  }

  function setup_grid() {
    var i, geom;
    geom = new THREE.Geometry();
    for (i = 1; i < max_grid_num; i++) {
      geom.vertices.push(new THREE.Vector3(0, i / max_grid_num, 1));
      geom.vertices.push(new THREE.Vector3(1, i / max_grid_num, 1));
      geom.vertices.push(new THREE.Vector3(i / max_grid_num, 0, 1));
      geom.vertices.push(new THREE.Vector3(i / max_grid_num, 1, 1));
    }
    grid = new THREE.Line(geom, new THREE.LineBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: 0x404040, opacity: 0.5, linewidth: 1
    }), THREE.LinePieces);
    scene2.add(grid);

    geom = new THREE.Geometry();
    geom.vertices.push(new THREE.Vector3(-1, 0, 2));
    geom.vertices.push(new THREE.Vector3(1, 0, 2));
    geom.vertices.push(new THREE.Vector3(0, -1, 2));
    geom.vertices.push(new THREE.Vector3(0, 1, 2));
    cross = new THREE.Line(geom, new THREE.LineBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: 0xffffff, opacity: 0.5, linewidth: 3
    }), THREE.LinePieces);
    scene2.add(cross);
  }

  function set_grid(navi, grid_size) {
    var nx = navi.x, ny = navi.y;
    var nscale = navi.scale;
    var w = plane.scale.x / 2;
    var h = plane.scale.y / 2;
    var x = -nx * nscale;
    var y = -ny * nscale;
    if (x < -w - 5) x = -w - 5;
    if (x > w + 5) x = w + 5;
    if (y < -h - 5) y = -h - 5;
    if (y > h + 5) y = h + 5;
    cross.position.set(x, -y, 0);

    var s = grid_size * nscale * max_grid_num;
    grid.scale.set(s, s, 1);
    x = (Math.floor((nx - w / nscale) / grid_size) * grid_size - nx) * nscale;
    y = (Math.ceil((ny + h / nscale) / grid_size) * grid_size - ny) * nscale;
    grid.position.set(x, -y, 0);
  }

  function draw_all(navi, state) {
    uniforms.scale.value = navi.scale;
    uniforms.origin.value.set(navi.x, -navi.y);
    uniforms.time.value = state.tick;

    renderer.render(scene1, camera, texture, true);
    renderer.render(scene2, camera);
  }

  renderer = new THREE.WebGLRenderer();
  renderer.setClearColor(0x000000, 1.0);

  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4);
  camera.position.set(0, 0, 3);

  scene1 = new THREE.Scene();
  ensure_particles(2);

  texture = new THREE.WebGLRenderTarget(1024, 1024);

  scene2 = new THREE.Scene();

  plane = new THREE.PlaneGeometry(1, 1);
  plane = new THREE.Mesh(plane, new THREE.ShaderMaterial({
    depthWrite: false,
    uniforms: { tDiffuse: { type: 't', value: texture } },
    vertexShader: Golgi.CellView.vert_pass_2,
    fragmentShader: Golgi.CellView.frag_pass_2
  }));
  scene2.add(plane);

  setup_grid();

  this.init = function() {
    dom.appendChild(renderer.domElement);
  };

  this.retire = function() {
    dom.removeChild(renderer.domElement);
  };

  this.resize = function(width, height) {
    camera.left = -width / 2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
    cross.scale.set(width + 10, height + 10, 1);
    renderer.setSize(width, height);
    plane.scale.set(width, height, 1);
  };

  this.draw = function(navi, state, sight, grid_size) {
    if (state.need_update) {
      state.need_update = false;
      set_particles(navi, state, sight);
    }

    if (grid_size) set_grid(navi, grid_size);
    cross.visible = grid.visible = !!grid_size;

    draw_all(navi, state);
  };

  this.get_particle_count = function() {
    return particles.geometry.faces.length / 2;
  };
};
