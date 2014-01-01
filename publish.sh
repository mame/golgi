#!/bin/sh
rm -rf build
git clone . -b gh-pages build
ruby gen-examples.rb
bundle exec middleman build
cd build
git add -A :/
git commit -m 'Update.'
git push origin gh-pages
cd ..
git push origin gh-pages
