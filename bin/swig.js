#!/usr/bin/env node
/*jslint es5: true */

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const UglifyJS = require('uglify-js');

const swig = require('../index');
const filters = require('../lib/filters');
const utils = require('../lib/utils');
swig.loader = swig.loaders.fs();

const package = require('../package');

// commander
const { Command } = require('commander');
const program = new Command();

/**
 * swig cli stdout fn
 * 
 * @param {String} file 输出的文件名
 * @param {String} res 输出的文件内容
 */
function stdout(file, res) {
  const { output } = program;
  if (output) {
    mkdirp(output);

    fs.writeFileSync(path.resolve(output, file), res, { flags: 'w' });
  } else {
    console.log(res);
  }
}

/**
 * 获取传入的swig上下文对象
 */
function stdctx() {
  const { json, context } = program;
  let ctx = {};
  if (json) {
    ctx = JSON.parse(swig.loader.load(json));
  } else if (context) {
    ctx = require(path.resolve(context));
  }

  return ctx;
}

// set swig filters
function setFilter() {
  const { filter } = program;
  filter && utils.each(require(path.resolve(filter)), function (filter, name) {
    swig.setFilter(name, filter);
  });
}

// set swig tags
function setTag() {
  const { tag } = program;
  tag && utils.each(require(path.resolve(tag)), function (tag, name) {
    swig.setTag(name, tag.parse, tag.compile, tag.ends, tag.block);
  });
}

// set swig options
function setOption() {
  const { opt } = program;
  opt && swig.setDefaults(require(path.resolve(opt)));
}

program.name(package.name)
  .version(package.version)
  .description(package.description)
  .usage("<command> <files> [options]")
  .option('-o, --output', 'Output location. [default: "output"]', "output")
  .option('-j, --json <jsonFile>', 'Variable context as a JSON file')
  .option('-c, --context <context>', 'Variable context as a CommonJS-style file. Used only if option `j` is not provided')
  .option('-m, --minify', 'Minify compiled functions with uglify-js')
  .option('--filter <filterFile>', 'Custom filters as a CommonJS-style file')
  .option('--tag <tagsFile>', 'Custom tags as a CommonJS-style file')
  .option('--opt <optFile>', 'Customize Swig\'s Options from a CommonJS-style file')
  .option('--wrap-start <wrapStart>', 'Template wrapper beginning for "compile". [default: "var tpl = "]', "var tpl = ")
  .option('--wrap-end <wrapEnd>', 'Template wrapper end for "compile". [default: ";"]', ";")
  .option('--method-name <methodName>', 'Method name to set template to and run from. [default: "tpl"]', "tpl")
  .action(function () {
    console.log('');
  });

program
  .command('compile <files...>')
  .description('compile a source file into a renderable template function')
  .option("-j, --json <jsonFile>", "Which setup mode to use")
  .action((files, options) => {
    setOption();
    setFilter();
    setTag();

    files.forEach(file => {
      const { wrapStart, wrapEnd, minify } = program;

      var r = swig.precompile(swig.loader.load(file), { filename: file, locals: stdctx() }).tpl.toString().replace('anonymous', '');
      r = wrapStart + r + wrapEnd;

      if (minify) {
        r = UglifyJS.minify(r).code;
      }

      let filename = path.parse(file).name;
      stdout(filename + ".tpl.js", r);
    });
  });

/**
 * 
 * @example
 * swig render swig.tpl -j swig.json
 */
program
  .command('render <files...>')
  .description('compile and render a template string for final output')
  .action(function (files, options) {
    setOption();
    setFilter();
    setTag();

    files.forEach(file => {
      let filename = path.parse(file).name;
      stdout(filename + ".html", swig.renderFile(file, stdctx()));
    });
  });

program
  .command('run <files...>')
  .description('run a pre-compiled template function')
  .action(function (files, options) {
    setOption();
    setFilter();
    setTag();

    files.forEach(file => {
      const { methodName } = program;
      eval(swig.loader.load(file));
      const __tpl = eval(methodName);

      let filename = path.parse(file).name;
      stdout(filename + ".html", __tpl(swig, stdctx(), filters, utils, function () { }));
    });
  });

program.parse(process.argv);

if (!program.args.length) {
  program.help();
}