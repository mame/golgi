ignore %r{\..*\.sw.$}

I18n.enforce_available_locales = true

activate :livereload

helpers do
  JS = %w(
    main.js
    hashlife.js
    rectview.js
    cellview.js
    navi.js
    state.js
    ui.js
    examples.js
  )

  def load_js
    src = JS.map {|f| File.read(File.join("js", f)) }.join
    [1, 2].each do |pass|
      %w(vert frag).each do |type|
        glsl = File.read("js/pass-#{ pass }.#{ type }")
        glsl.gsub!(%r(/\*.*?\*/), "")
        glsl.gsub!(/(\w)\s+(\w)/) { $1 + "\0" + $2 }
        glsl.gsub!(/\s+/, "")
        glsl.gsub!("\0", " ") 
        glsl.gsub!(/'/) { "\\'" }
        src << "Golgi.CellView.#{ type }_pass_#{ pass } = "
        src << '"' + glsl + '";'
      end
    end
    src
  end

  def load_three_js
    File.read(File.join("vendor", "three.js"))
  end
end

configure :build do
  activate :minify_css

  activate :imageoptim do |image_optim|
    image_optim.pngout_options = false
  end

  require "closure-compiler"
  activate :minify_javascript
  set :js_compressor, ::Closure::Compiler.new
end
