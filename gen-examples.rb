system("unzip", "-q", "-o", "-d", "patterns", "vendor/all.zip")

Examples = %w(
  pentadecathlon.rle
  rpentomino.rle
  p46gun.rle
  scrubber_with_blocks.rle
  cap.rle
  2x2glider.rle
  beacon.rle
  acorn.rle
  blocker.rle
  prepulsarpredecessor.rle
  tumbler.rle
  mazewickstretcher.rle
  beehivepuffer.rle
  cross.rle
  c3ladder.rle
  2x2linepuffer.rle
  star.rle
  twoeaters.rle
  achimsp16.rle
  bunnies.rle
  koksgalaxy.rle
  orion.rle
  pinwheel.rle
  unidimensionaltumbler.rle
  aforall.rle
  snakedance.rle
  turtle.rle
  26p40.rle
  unidimensionalnothing.rle
  coeship.rle
  crabtubstretcher.rle
  achimsp144.rle
  dart.rle
  edgerepairspaceship1.rle
  roteightor.rle
  46p22.rle 60p3h1v0.3.rle washerwoman.rle
  unicycle.rle
  windmill.rle
  lightweightemulator.rle
  ellisonp4hwemulatorhybrid.rle
  prepulsar.rle
  35p52.rle
  brain.rle
  swan.rle
  b29.rle
  48p22.rle
  crab.rle
  x66.rle
  ecologist.rle
  harbor.rle
  newgun1.rle
  clock.rle
  sparky.rle
  bottle.rle
  cross2.rle
  swanboatstretcher.rle
  pulsar.rle
  doubleewe.rle
  gourmet.rle
  sixtynine.rle
  56p27.rle
  blinkerpuffer2.rle
  shipinabottle.rle
  twoprelhasslers.rle
  boatstretcher1.rle
  originalp56bheptominoshuttle.rle
  88p28.rle
  snail.rle
  alternatewickstretcher1.rle
  77p6h1v1.rle
  piportraitor.rle
  104p177.rle
  112p51.rle
  turtlewithtagalong.rle
  waveguide1.rle
  popover.rle
  quasar.rle
  spacefiller2.rle
  roteightorextension.rle
  wickstretcher1.rle
  seal.rle
  dinnertableextension.rle
  electricfence.rle
  ringoffire.rle
  spacefiller1.rle
  prepulsarshuttle29v3.rle
  lightspeedoscillator1.rle
  lifewithoutdeathquadraticgrowth.rle
  c2wickstretcher.rle
  p58toadsucker.rle
  newshuttle.rle
  piship1.rle
  lightspeedoscillator2.rle
  p6diagonalwickstretcher1.rle
  doublex.rle
  p230glidershuttle.rle
  400p49.rle
  lightspeedoscillator3.rle
).map {|file| File.join("patterns", file) }

# ringoffire

open("js/examples.js", "w") do |f|
  f.puts "/**"
  f.puts " * Example configurations"
  f.puts " */"
  f.puts "Golgi.examples = {"
  c = 0
  first = true
  Examples.map do |file|
    src = File.read(file).gsub("\r", "")
    title = src[/#N\s*(.*)/, 1]
    [title, src]
  end.sort_by {|title,| title.downcase }.each do |title, src|
    c += 1
    src = src.gsub("'") { "\\'" }.gsub("\n", "\\n")
    p title
    src = "  '#{ title.gsub("'") { "\\'" } }': '#{ src }',"
    src.chop! if Examples.size == c
    f.puts if !first
    first = false
    while src.size > 79
      line = src.slice!(0, 77)
      if line.end_with?("\\")
        line = line.slice!(0, 76)
        src = "\\" + src
      end
      f.puts(line + "' +")
      src = "    '" + src
    end
    f.puts src
  end
  f.puts "};"
end
