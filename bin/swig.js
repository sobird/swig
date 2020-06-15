#!/usr/bin/env node
/*jslint es5: true */

var swig = require('../index'),
  optimist = require('optimist'),
  fs = require('fs'),
  path = require('path'),
  filters = require('../lib/filters'),
  utils = require('../lib/utils'),
  uglify = require('uglify-js');
const package = require('../package');

// commander
const { Command } = require('commander');
const program = new Command();

program.name(package.name)
  .version(package.version)
  .description(package.description)
  .usage("<command> <files> [options]");

program
  .command('compile <files>')
  .description('compile a source file into a renderable template function')
  .option("-j, --json [.json]", "Which setup mode to use")
  .action(function(env, options){
    //const { args } = options;

    console.log(options.json);
    
  });

  program
  .command('render <files>')
  .description('compile a source file into a renderable template function')
  .option("-s, --setup_mode [mode]", "Which setup mode to use")
  .action(function(env, options){
    const { args } = options;

    console.log(args);
    const mode = options.setup_mode || "normal";
    env = env || 'all';
    console.log('setup for %s env(s) with %s mode', env, mode);
  });

  program
  .command('run <files>')
  .description('run a pre-compiled template function')
  .option("-s, --setup_mode [mode]", "Which setup mode to use")
  .action(function(env, options){
    const { args } = options;

    console.log(args);
    const mode = options.setup_mode || "normal";
    env = env || 'all';
    console.log('setup for %s env(s) with %s mode', env, mode);
  });

program
 .option('-o, --output', 'Output location. [default: "stdout"]')
 //.option('-j, --json', 'Variable context as a JSON file')
 .option('-c, --context', 'Variable context as a CommonJS-style file. Used only if option `j` is not provided')
 .option('-m, --minify', 'Minify compiled functions with uglify-js')
 .option('--filters', 'Custom filters as a CommonJS-style file')
 .option('--tags', 'Custom tags as a CommonJS-style file')
 .option('--options', 'Customize Swig\'s Options from a CommonJS-style file')
 .option('--wrap-start ', 'Template wrapper beginning for "compile". [default: "var tpl = "]')
 .option('--wrap-end', 'Template wrapper end for "compile". [default: ";"]')
 .option('--method-name', 'Method name to set template to and run from. [default: "tpl"]');


program.parse(process.argv);

if (!program.args.length) {
  program.help();
}
return;


// // swig compile


// program.command('run <files> [options]')
//   .description("run a pre-compiled template function")
//   .action((files, destination) => {
//     console.log(files);

//     swig.compileFile();
//   });

// program
//   .command('exec <cmd>')
//   .alias('ex')
//   .description('execute the given remote cmd')
//   .option("-e, --exec_mode <mode>", "Which exec mode to use")
//   .action(function (cmd, options) {
//     console.log(options);
//   }).on('--help', function () {
//     console.log('');
//     console.log('Examples:');
//     console.log('');
//     console.log('  $ deploy exec sequential');
//     console.log('  $ deploy exec async');
//   });

// program.parse(process.argv);
// return;
var command,
  wrapstart = 'var tpl = ',
  argv = optimist
    .usage('\n Usage:\n' +
      '    $0 compile [files] [options]\n' +
      '    $0 run [files] [options]\n' +
      '    $0 render [files] [options]\n'
    )
    .describe({
      v: 'Show the Swig version number.',
      o: 'Output location.',
      h: 'Show this help screen.',
      j: 'Variable context as a JSON file.',
      c: 'Variable context as a CommonJS-style file. Used only if option `j` is not provided.',
      m: 'Minify compiled functions with uglify-js',
      'filters': 'Custom filters as a CommonJS-style file',
      'tags': 'Custom tags as a CommonJS-style file',
      'options': 'Customize Swig\'s Options from a CommonJS-style file',
      'wrap-start': 'Template wrapper beginning for "compile".',
      'wrap-end': 'Template wrapper end for "compile".',
      'method-name': 'Method name to set template to and run from.'
    })
    .alias('v', 'version')
    .alias('o', 'output')
    .default('o', 'stdout')
    .alias('h', 'help')
    .alias('j', 'json')
    .alias('c', 'context')
    .alias('m', 'minify')
    .default('wrap-start', wrapstart)
    .default('wrap-end', ';')
    .default('method-name', 'tpl')
    .check(function (argv) {
      if (argv.v) {
        return;
      }

      if (!argv._.length) {
        throw new Error('');
      }

      command = argv._.shift();
      if (command !== 'compile' && command !== 'render' && command !== 'run') {
        throw new Error('Unrecognized command "' + command + '". Use -h for help.');
      }

      if (argv['method-name'] !== 'tpl' && argv['wrap-start'] !== wrapstart) {
        throw new Error('Cannot use arguments "--method-name" and "--wrap-start" together.');
      }

      if (argv['method-name'] !== 'tpl') {
        argv['wrap-start'] = 'var ' + argv['method-name'] + ' = ';
      }
    })
    .argv,
  ctx = {},
  out = function (file, str) {
    console.log(str);
  },
  efn = function () { },
  anonymous,
  files,
  fn;

// What version?
if (argv.v) {
  console.log(require('../package').version);
  process.exit(0);
}

// Pull in any context data provided
if (argv.j) {
  ctx = JSON.parse(fs.readFileSync(argv.j, 'utf8'));
} else if (argv.c) {
  ctx = require(argv.c);
}

if (argv.o !== 'stdout') {
  argv.o += '/';
  argv.o = path.normalize(argv.o);

  try {
    fs.mkdirSync(argv.o);
  } catch (e) {
    if (e.errno !== 47) {
      throw e;
    }
  }

  out = function (file, str) {
    file = path.basename(file);
    fs.writeFileSync(argv.o + file, str, { flags: 'w' });
    console.log('Wrote', argv.o + file);
  };
}

// Set any custom filters
if (argv.filters) {
  utils.each(require(path.resolve(argv.filters)), function (filter, name) {
    swig.setFilter(name, filter);
  });
}

// Set any custom tags
if (argv.tags) {
  utils.each(require(path.resolve(argv.tags)), function (tag, name) {
    swig.setTag(name, tag.parse, tag.compile, tag.ends, tag.block);
  });
}

// Specify swig default options
if (argv.options) {
  swig.setDefaults(require(argv.options));
}

switch (command) {
  case 'compile':
    fn = function (file, str) {
      var r = swig.precompile(str, { filename: file, locals: ctx }).tpl.toString().replace('anonymous', '');

      r = argv['wrap-start'] + r + argv['wrap-end'];

      if (argv.m) {
        r = uglify.minify(r, { fromString: true }).code;
      }

      out(file, r);
    };
    break;

  case 'run':
    fn = function (file, str) {
      (function () {
        eval(str);
        var __tpl = eval(argv['method-name']);
        out(file, __tpl(swig, ctx, filters, utils, efn));
      }());
    };
    break;

  case 'render':
    
    fn = function (file, str) {
      console.log(file);
      out(file, swig.render(str, { filename: file, locals: ctx }));
    };
    break;
}

argv._.forEach(function (file) {
  var str = fs.readFileSync(file, 'utf8');
  fn(file, str);
});
