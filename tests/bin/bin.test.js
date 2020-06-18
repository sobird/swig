const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;

const expect = require('expect.js');
const _ = require('lodash');
const glob = require('glob');
const UglifyJS = require('uglify-js');

const swig = require('../../lib/swig');
const binDir = __dirname;
const testDir = path.dirname(binDir);
const swigBin = path.join(testDir, '../bin/swig.js');
const caseDir = path.join(testDir, 'cases');
const tmpDir = path.join(testDir, 'tmp');

const locals = path.join(binDir, 'bin.locals.json');

function resetOptions() {
  swig.setDefaults((new swig.Swig()).options);
  swig.invalidateCache();
}

const testFiles = glob.sync('*.test.html', { cwd: caseDir, absolute: false });
const expectationFiles = glob.sync('*.expectation.html', { cwd: caseDir, absolute: false });
const cases = _.groupBy([...testFiles, ...expectationFiles], function (f) {
  return f.split('.')[0];
});
const casesKeys = _.keys(cases);

describe('bin/swig -V', function () {
  it('shows the version number', function (done) {
    exec('node ' + swigBin + ' -V', function (err, stdout, stderr) {
      expect((/^\d+\.\d+\.\d+/).test(stdout)).to.equal(true);
      done();
    });
  });
});

describe('bin/swig render', function () {
  const key = casesKeys[_.random(casesKeys.length - 1)];
  const kase = cases[key];
  const test = path.join(caseDir, kase[0]);
  const expectation = fs.readFileSync(path.join(caseDir, kase[1]), 'utf8');

  it(key, function (done) {
    exec('node ' + swigBin + ' render ' + test + ' -j ' + locals, function (err, stdout, stderr) {
      expect(stdout.replace(/\n$/, '')).to.equal(expectation);
      done();
    });
  });
});

describe('bin/swig compile + run', function () {
  const key = casesKeys[_.random(casesKeys.length - 1)];
  const kase = cases[key];
  const test = path.join(caseDir, kase[0]);
  const expectation = fs.readFileSync(path.join(caseDir, kase[1]), 'utf8');

  it(key, function (done) {
    exec('node ' + swigBin + ' compile ' + test + ' -j ' + locals + ' -o ' + tmpDir, function (err, stdout, stderr) {
      let runJs = path.join(tmpDir, path.parse(test).name + ".tpl.js");
      exec('node ' + swigBin + ' run ' + runJs + ' -c ' + locals, function (err, stdout, stdrr) {
        expect(stdout.replace(/\n$/, '')).to.equal(expectation);
        done();
      });
    });
  });
});

describe('bin/swig compile -m', function () {
  it('minifies output', function (done) {
    let test = path.join(caseDir, 'extends_1.test.html');
    exec('node ' + swigBin + ' compile ' + test  + ' -j ' + locals + ' -m', function (err, stdout, stderr) {
      exec('node ' + swigBin + ' compile ' + test + ' -j ' + locals, function (err, stdout2, stderr) {
        expect(stdout.replace(/\n$/, '')).to.equal(UglifyJS.minify(stdout2).code);
        done();
      });
    });
  });
});

describe('bin/swig compile --method-name="foo"', function () {
  it('sets the method name to "foo"', function (done) {
    var test = path.join(caseDir, 'extends_1.test.html');
    exec('node ' + swigBin + ' compile ' + test + ' --method-name="foo"', function (err, stdout, stderr) {
      expect(stdout.replace(/\n$/, '')).to.equal('var foo = function (_swig,_ctx,_filters,_utils,_fn) {  var _ext = _swig.extensions,    _output = "";_output += "Hi,\\n\\n";_output += "This is the body.";_output += "\\n\\nSincerely,\\nMe\\n";  return _output;};');
      done();
    });
  });
});

describe('bin/swig compile --wrap-start="var foo = " & run from swig', function () {
  it('can be run', function (done) {
    let test = path.join(caseDir, 'extends_1.test.html');
    let expectation = fs.readFileSync(path.join(caseDir, 'extends_1.expectation.html'), 'utf8');
    exec('node ' + swigBin + ' compile ' + test + ' --wrap-start="var foo = "', function (err, stdout, stderr) {
      var foo;
      eval(stdout);
      expect(swig.run(foo)).to.equal(expectation);
      done();
    });
  });
});

describe('bin/swig render with custom extensions', function () {
  it('works with custom filter', function (done) {
    const filter = path.join(binDir, 'bin.filters.js');
    const test = path.join(binDir, 'custom_filter.bin.html');

    exec('node ' + swigBin + ' render ' + test + ' --filter ' + filter + ' -j ' + locals, function (err, stdout, stderr) {
      expect(stdout).to.equal('I want Nachos please!\n\n');
      done();
    });
  });

  it('works with custom tag', function (done) {
    const tag = path.join(binDir, 'bin.tags.js');
    const test = path.join(binDir, 'custom_tag.bin.html');

    exec('node ' + swigBin + ' render ' + test + ' --tag ' + tag + ' -j ' + locals, function (err, stdout, stderr) {
      expect(stdout).to.equal('flour tortilla!\n\n');
      done();
    });
  });
});

describe('bin/swig custom options', function () {
  const options = path.join(binDir, 'options.js');

  beforeEach(resetOptions);
  afterEach(resetOptions);

  it('change varControls', function (done) {
    const test = path.join(binDir, 'custom_varControls.bin.html');

    exec('node ' + swigBin + ' render ' + test + ' --opt ' + options + ' -j ' + locals, function (err, stdout, stderr) {
      expect(stdout).to.equal('hello world\n\n');
      done();
    });
  });

  it('change tagControls', function (done) {
    const test = path.join(binDir, 'custom_tagControls.bin.html');

    exec('node ' + swigBin + ' render ' + test + ' --opt ' + options + ' -j ' + locals, function (err, stdout, stderr) {
      expect(stdout).to.equal('hello world\n\n');
      done();
    });
  });
});
return;