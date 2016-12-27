var _ = require("lodash");
var color = require('bash-color');
var fs = require('fs');
var path = require('path');
var async = require('async');

var bookJson = require('../bookJson');
var utils = require('../utils');
var readFile = require('../files');

/**
 * Get a summary from a fold such as `/path/to/your/book` or `../book`
 * @param root path
 */

// Give some variables
var root,
    bookname, // todo: don`t use `name`?
    outputFile,
    catalog,
    ignores,
    unchanged,
    sortedBy,
    levelsigns;

// Get options
function init(options) {
    root = options.root || '.';
    var bookConfig = bookJson(root);
    utils.rewrite(options, bookConfig);

    outputFile = options.outputfile || bookConfig.outputfile;
    catalog = options.catalog || bookConfig.catalog;
    ignores = options.ignores || bookConfig.ignores;
    unchanged = options.unchanged || bookConfig.unchanged;
    bookname = options.bookname || bookConfig.bookname;
    sortedBy = options.sortedBy || bookConfig.sortedBy;
    levelsigns = options.levelsigns || bookConfig.levelsigns;
    if(_.isString(levelsigns)) {
      levelsigns = levelsigns.split(',')
    }
}

// Get summary
function Summary(options) {
    var result = '',
        desc = '',
        step = 0,
        skip = null,
        filesObj;

    async.auto({
        init: function(next) {
            init(options);

            // Ignore the outputFile, for example `SUMMARY`
            ignores.push(_.trim(outputFile, '.md'));

            next();
        },

        files: ['init', function(next) {
            filesObj = getFiles(root);
            if (filesObj) {
                next();
            } else {
                next(color.red("Sorry, something is going wrong or no markdowns."));
            }
        }],

        parse: ['files', function(next) {
            work(filesObj);
            next();
        }],

        write: ['parse', function(next) {
            bookname = "# " + bookname + "\n\n";
            result += bookname + desc;

            writeFile(outputFile, result);
        }]
    }, function(err, results) {
        console.log(err);
    });

    function work(filesObj) {
        _.forEach(filesObj, function(n, key) {
            if (!_.includes(ignores, key)) {
                console.log("processing "+ _.repeat('..', step) + key);
                if (_.isObject(n)) {

                    console.log("isObject");

                    // It means folderName == subFileName, for example: */assets/assets.md or */Assets/assets.md
                    if (_.isString(n[key])
                      || _.isString(n[key.toLowerCase()])
                      || _.isString(n[getFileNameWithoutSortedPrefix(key)])
                      || _.isString(n[getFileNameWithoutSortedPrefix(key).toLowerCase()])

                    ) {
                      console.log("isString key");

                      var file = n[key]
                          || n[key.toLowerCase()]
                          || n[getFileNameWithoutSortedPrefix(key)]
                          || n[getFileNameWithoutSortedPrefix(key).toLowerCase()]
                        ;
                      desc += _.repeat(' ', step) + formatCatalog(key, '*') + file;

                      // Mark it to skip
                      if (n[key]
                        || n[key.toLowerCase()])
                        skip = key;
                      else
                        skip = getFileNameWithoutSortedPrefix(key);

                    } else

                    // The file is `readme.md`
                    if (_.isString(n['readme']) || _.isString(n['Readme']) || _.isString(n['README'])) {


                        var readmeDir = n['readme'] || n['Readme'] || n['README'];
                      console.log("readmeDir "+readmeDir);

                      skip = 'readme';
                        desc += _.repeat(' ', step) + formatCatalog(key, '-') + readmeDir;
                    } else {
                        console.log("simple dir "+key);
                        var dirSign = levelsigns[step/2] || '-';
                        console.log(levelsigns+ " levelsigns "+ dirSign);
                        desc += '\n'+ _.repeat(' ', step) + dirSign+" " + prettyCatalogName(key) + "\n";
                    }

                    // Start a loop
                    step += 2;
                    work(n);
                    step -= 2;
                } else {
                    // Skip if `skip` exists or key == `readme`
                    if (isSkiped(key, skip)) {
                        console.log("skipped "+key);
                        return;
                    }


                    console.log("entry "+key);
                    desc += _.repeat(' ', step) + formatCatalog(key, '*') + n;
                }
            }
        });
    }
}

// Get a filesJson Object
function getFiles(root) {
    var result = null,
        filesJson = {};

    readFile(root, filesJson, sortedBy);

    if (filesJson) {
        result = _.pick(filesJson, filterRules);
    }

    return result;
}

// Filter in the `catalog` and exclude in the `ignores`
function filterRules(n, key) {
    var result = null;

    // Ignore hidden files, for example `.git`
    if (/^[\.]|'_book'|'node_modules'/.test(key)) {
        ignores.push(key);
    }

    if (catalog === 'all') {
        result = !_.includes(ignores, key);
    } else {
        result = _.includes(catalog, key) && !_.includes(ignores, key);
    }

    return result;
}

// Sign is `-` when folders, `*` when files
function formatCatalog(folderName, sign) {

    sign = sign || '*';
    return sign + " [" + prettyCatalogName(folderName) + "](";
}

function getFileNameWithoutSortedPrefix(fileName) {
  if (sortedBy) {
    var pattern = "^[\\da-zA-Z]*" + sortedBy;
    var reg = new RegExp(pattern);

    if (reg.test(fileName)) {
      var folderNameReg = new RegExp(pattern + "(.*)");
      fileName = fileName.match(folderNameReg)[1];
    }
  }
  return fileName;
}

function prettyCatalogName(fileName) {
    // Sorted if given a sorted hyphen, for example: `-` or `_`
    fileName = getFileNameWithoutSortedPrefix(fileName);

    // Don`t format the files like `req.options.*` using dot, unchanged or Chinese string.
    if (_.size(fileName.split(".")) > 1 || _.includes(unchanged, fileName) || isChinese(fileName)) {
        return fileName;
    }
    return _.startCase(fileName);
}

function isChinese(string) {
    var req = /[\u4E00-\u9FA5]|[\uFE30-\uFFA0]/gi;
    return req.exec(string);
}

function isSkiped(key, skip) {
    return !_.isEmpty(skip)
      && _.isEqual(key.toLowerCase(), skip.toLowerCase()) ;
}

// Write to file  encoded with utf-8
function writeFile(fileName, data) {
    fs.writeFile(fileName, data, 'utf-8', function() {
        console.log(color.green("Finished, generate a SUMMARY.md successfully."));
    })
}

module.exports = Summary;
