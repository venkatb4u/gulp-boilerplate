var gulp = require('gulp');
    //sass = require('gulp-ruby-sass'),
var sass = require('gulp-sass');
var autoprefixer = require('gulp-autoprefixer');
var minifycss = require('gulp-minify-css');

var jshint = require('gulp-jshint');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');

var gutil = require('gulp-util');
var sourcemaps = require('gulp-sourcemaps');
var rev = require('gulp-rev');

var imagemin = require('gulp-imagemin');
var pngquant = require('imagemin-pngquant');

// Path var declarations

var input  = {
      'sass': 'sass/**/*.scss',
      'javascript': 'js/**/*.js',
      'vendorjs': 'vendor/**/*.js'
    },

    output = {
      'stylesheets': 'public/css',
      'javascript': 'public/js'
    };

// Tasks


gulp.task('express', function() {
  var express = require('express');
  var app = express();
  app.use(require('connect-livereload')({port: 4002}));
  app.use(express.static(__dirname));
  app.listen(4000, '0.0.0.0');
});


// LiveReload concept -- Tinyrl
var tinylr;
gulp.task('livereload', function() {
  tinylr = require('tiny-lr')();
    tinylr.listen(35729);
});

function notifyLiveReload(event) {
  var fileName = require('path').relative(__dirname, event.path);

  tinylr.changed({
    body: {
      files: [fileName]
    }
  });
}

// Simple Copy Task
gulp.task('copy', function() {
  gulp.src('js/*.js')
  	  .pipe(gulp.dest('public/copied_files'));
});

// Compiles scss and minifies styles
gulp.task('styles', function() {
  //return sass('sass', { style: 'expanded' })
  return gulp.src('sass/*.scss')
  		.pipe(sass())
	    .pipe(gulp.dest('public/css'))
	    .pipe(rename({suffix: '.min'}))
	    .pipe(minifycss())
	    .pipe(gulp.dest('public/css'));
});

// Concatenate & Minify JS
gulp.task('scripts', function() {
    return gulp.src('js/*.js')
        .pipe(concat('all.js'))
        .pipe(gulp.dest('public/js'))
        .pipe(rename('all.min.js'))
        .pipe(uglify())
        .pipe(gulp.dest('public/js'));
});

// concat javascript files, minify if --type production
gulp.task('build-js', function() {
  return gulp.src(input.javascript)
    .pipe(sourcemaps.init())
    .pipe(concat('bundle.js'))
    //only uglify if gulp is ran with '--type production'
    .pipe(gutil.env.type === 'production' ? uglify() : gutil.noop()) 
    .pipe(sourcemaps.write())
    .pipe(gulp.dest(output.javascript));
});

// Lint Task
gulp.task('lint', function() {
    return gulp.src('js/*.js')
        .pipe(jshint())
        .pipe(jshint.reporter('default'));
});

// Rev handling
gulp.task('rev', function () {
    return gulp.src(['sass/*.scss', 'js/*.js'])
    	  .pipe(gulp.dest('build/rev'))  // copy original assets to public
	      .pipe(rev())
    	  .pipe(gulp.dest('public/rev'))  // write rev'd assets to public
    	  .pipe(rev.manifest())
    	  .pipe(gulp.dest('public/rev'));  // write manifest to public
});

// Image minifications
gulp.task('imagemin', function () {
    return gulp.src('images/*')
        .pipe(imagemin({
            progressive: true,
            svgoPlugins: [{removeViewBox: false}],
            use: [pngquant()]
        }))
        .pipe(gulp.dest('public/images'));
});

// Watch 

gulp.task('watch', function() {
  gulp.watch('js/*.js', ['lint', 'scripts']);
  gulp.watch('sass/*.scss', ['styles']);
  gulp.watch('*.html', notifyLiveReload);
  gulp.watch('css/*.css', notifyLiveReload);
});

gulp.task('default', ['styles', 'express', 'livereload', 'watch'], function() {

});