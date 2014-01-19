module.exports = function(grunt) {
  function bannerText() {/**
 * SymSpell <%= pkg.version %>-<%= grunt.template.today("ddmmyyyy") %>
 * An implementation of the Symmetric Delete spelling correction algorithm.
 * This is fast and language-independent.
 *
 * Based on C# code and algorithm version 1.6
 * Copyright (C) 2012 Wolf Garbe <wolf.garbe@faroo.com>, FAROO Limited
 * See: http://blog.faroo.com/2012/06/07/improved-edit-distance-based-spelling-correction/
 * and http://blog.faroo.com/2012/06/24/1000x-faster-spelling-correction-source-code-released/
 *
 * This version was written by Isaac Sukin (@IceCreamYou).
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License,
 * version 3.0 (LGPL-3.0) as published by the Free Software Foundation.
 * http://www.opensource.org/licenses/LGPL-3.0
 */}
  var banner = (bannerText+'').replace(/function.+?{|}/g, '');
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    uglify: {
      options: {
        banner: banner,
        sourceMap: 'js/symspell.min.map',
        compress: {
          side_effects: false,
          unused: false
        },
        mangle: true,
        report: 'min'
      },
      target: {
        src: ['symspell.js'],
        dest: 'symspell.min.js'
      }
    },
    jshint: {
      options: {
        trailing: true
      },
      target: {
        src : ['symspell.js']
      }
    },
    jscs: {
      main: ['symspell.js']
    }
  });

  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks("grunt-jscs-checker");
  grunt.registerTask('default', ['uglify', 'jshint', 'jscs']);
};