'use strict';

module.exports = function (grunt) {
    require('grunt-browserify')(grunt);
    require('grunt-contrib-uglify')(grunt);

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        browserify: {
            dist: {
                options: {
                    transform: [['babelify', {
                        presets: ['es2015']
                    }]],
                },
                files: {
                    'dist/funneler.js': [ 'lib/**/*.js' ],
                }
            }
        },

        uglify: {
            build: {
                src: [ 'dist/funneler.js' ],
                dest: 'dist/funneler.min.js',
                options: { sourceMap: false }
            }
        },
    });

    grunt.registerTask('default', [
        'browserify', 
        'uglify',
    ]);
};
