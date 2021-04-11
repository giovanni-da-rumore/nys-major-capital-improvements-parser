const fs = require('fs') 


function isDocketNum(item) {
    // test to see if item is close enough to pattern, e.g. BX630003X or GM610075OM
    if (item.length < 9 || item.length > 10) return false
    // letter, letter, number, number
    if (!isNaN(item[0])) return false
    if (!isNaN(item[1])) return false
    if (isNaN(item[2])) return false
    if (isNaN(item[3])) return false
    return true
}

function isBldgId(item) {
    return (item.length === 6 || item.length === 7) && !isNaN(item)
}

function parseMCItems(line) {
    // remove commas in line
    const newLine = [line[0].split(',').join(" | "), ...line.slice(1)]
    if (newLine.length === 3) {
        // insert missing allow cost as 0
        newLine.splice(2, 0, '0')
        // return newLine.slice(0, 2).concat([0, newLine[2]])
    }
    if (newLine.length === 5) {
        // in some cases, there are two spaces between words in the description column, so they
        // get split into two columns. Put them back together. 
        const beginning = newLine.shift()
        newLine[0] = `${beginning} ${newLine[0]}`
        // Note, might want to check if you change files, but proved for these specific files
        // that all mcitems of length 5 have an unwanted split for their first column
    }
    return newLine
}

function checkAndFillDocketLine(line, startIdx) {
    // fill in N/A for missing items, can be closed date, close code or both
    if (line.length === 9) {
        // in this case, docket is in first and missing close date and close code and 
        line.splice(8, 0, 'N/A')
        line.splice(9, 0, 'NONE')
    } else if (line.length === 6) {
        //  docket line is by self and missing close date
        line.splice(4, 0, 'N/A')
    } else if (line.length === 5) {
        // docket line is by self and missing close date and close code
        line.splice(4, 0, 'N/A')
        line.splice(5, 0, 'NONE')
    }
}

function parseFile(file) {
    const allLines = [];
    let makingLine = false
    let addressBreak = false
    let currentLines = []
    let currentBaseLine = []
    let currentDocketLine = []
    let firstDocketLine = false
    // let testingIdx = 0
    let testLog = false
    let pauseForPageBreak = false
    let currentIdx = 0
    let haveError = false

    file.split('\n').forEach((line, idx) => {
        // dont bother parsing if theres an error
        if (haveError) return

        const parsedLine = line.trim().split(/\s\s+/);
        // this means there's a page break, so pause collection until...
        if (parsedLine[0] === '*** D R A F T') {
            pauseForPageBreak = true;
            return;
        }
        // ...page break ends
        if (pauseForPageBreak) {
            if (parsedLine[0] === '--------------------') {
                pauseForPageBreak = false
            }
            return 
        }
        // there are many blank lines in the doc, ignore them
        if (parsedLine.length === 1) return

        // begin a new line/group when you find a buildingID
        if (isBldgId(parsedLine[0])) {
            if (parsedLine.length === 2) {
                // add old lines, now that you know they've completed
                allLines.push(...currentLines)
                // clear data and start new lines
                currentBaseLine = parsedLine;
                currentLines = []
                currentIdx = 0
                // prepare to collect address & most data in the next line
                addressBreak = true;
                makingLine = true
            } else {
                console.log('error, check line number', idx)
                haveError = true
            }
            return 
        }
        // dont do anything if you're still at the beginning of a file
        if (!makingLine) return

        // every initial line has a break in its address
        if (addressBreak) {
            // add to baseline, i.e. finish its second element. Split on comma so state isn't its own colum
            currentBaseLine[1] += ` ${parsedLine[0]}`.split(',').join('')
            // if claim is still open, line is might be missing some elements that need filled in for csv
            checkAndFillDocketLine(parsedLine)
            // make zip code its own column & add rg & rc count to currentBaseLine
            currentBaseLine = currentBaseLine.concat(parsedLine.slice(1, 4))
            // after basesline ends (idx 3, rc count), add docket info to current line and make base docket line
            currentDocketLine = [...currentBaseLine, ...parsedLine.slice(4)]
            // currentIdx should be 0
            currentLines[currentIdx] = currentDocketLine
            addressBreak = false
            firstDocketLine = true
            return
        }
        // see if items are under a new doocket number, and if so, update accordingly
        if (isDocketNum(parsedLine[0])) {
            checkAndFillDocketLine(parsedLine)
            currentDocketLine = currentBaseLine.concat(parsedLine)
            currentLines.push(currentDocketLine)            
            // move idx to next line, so can add new mc items to it if need be
            currentIdx++
            firstDocketLine = true

        } else {
            // if not, add individual items to existing docket number
            const mcItems = parseMCItems(parsedLine)
            // if first instance of a docket number, append data to the end of the line
            if (firstDocketLine) {
                firstDocketLine = false
                currentLines[currentIdx] = currentLines[currentIdx].concat(mcItems)
                if (currentLines[currentIdx].length === 17) {
                    console.log(parsedLine)
                }
            } else {
            // otherwise, make another row for this docket number and specific item
                currentLines.push(currentDocketLine.concat(mcItems))
                currentIdx++
            }
        }
    })
    // catch remaining lines and add them to list
    if (currentLines.length) {
        allLines.push(...currentLines)
    }
    return allLines
}


function writeToCSV(data, fileName = 'parsedData') {
    const header = [
        'BLDG ID', 'STREET ADDRESS', 'ZIP CODE', 'LAST REG', 'RC COUNT', 
        'DOCKET NO', 'CASE TYPE', 'CASE STATUS', 'FILING DATE',
        'CLOSING DATE', 'CLOSE CODE', 'STAFF ID', 'MCI ITEM',
        'CLAIM COST', 'ALLOW COST', 'WK BEG DT'
    ]
    const outputFile = fs.createWriteStream(`csvs/${fileName}.csv`);
    outputFile.on('error', function(err) { console.log('writing error', err)});
    outputFile.write(header.join(', ') + '\r\n')
    data.forEach(function(row, index) {
        // fix oddly formatted addresses (mostly in Queens) so they work with nyc gov's geocode API
        if (row[1].split(' TO ').length > 1) {
            row[1] = row[1].split(' TO ')[1]
        }
        outputFile.write(row.join(', ') + '\r\n'); 
    });
    outputFile.end();
}


function convertFilesToCSV(fileNames, directory = 'textFiles', ext = 'TXT') {
    fileNames.forEach((fileName) => {
        const hubFile = fs.readFileSync(`${__dirname}/${directory}/${fileName}.${ext}`, 'utf-8')
        const parsedData = parseFile(hubFile)
        if (parsedData) {
            writeToCSV(parsedData, fileName)
        }
    })
}

// to parse files, simply add file names to this list and run the file. 
// Each file will output to a csv with the same name 
const fileNames = [
    'HUBC137_P530', 
    'HUBC137_P531', 
    'HUBC137_P532',
    'HUBC137_P533',
    'HUBC137_P534'
]

convertFilesToCSV(fileNames)



