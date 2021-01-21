const fs = require('fs') 


function isDocketNum(item) {
    if (item.length < 9 || item.length > 10) return false
    if (!isNaN(item[0])) return false
    if (!isNaN(item[1])) return false
    if (isNaN(item[2])) return false
    if (isNaN(item[3])) return false
    // close enough to pattern, e.g. 
    // BX630003X
    // GM610075OM
    // letter, letter, number, number
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
    return newLine
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
            // add to baseline, i.e. finish its second element 
            currentBaseLine[1] += ` ${parsedLine[0]}`.split(',').join('')
            if (parsedLine.length === 9) {
                // if claim is still open, line doesn't have
                // closed date nor Close Code
                parsedLine.splice(8, 0, 'N/A')
                parsedLine.splice(9, 0, 'NONE')

            }
            // make zip code its own column & add
            // rg & rc count to currentBaseLine
            currentBaseLine = currentBaseLine.concat(parsedLine.slice(1, 4))
            // after basesline (ends idx 3, rc count) add docket info to current line to make a docket line
            currentDocketLine = [...currentBaseLine, ...parsedLine.slice(4)]
            // currentIdx should be 0
            currentLines[currentIdx] = currentDocketLine
            addressBreak = false
            firstDocketLine = true
            return
        }
        // see if items are under a new doocket number, and if so, update accordingly
        if (isDocketNum(parsedLine[0])) {
            // this length means claim is open, so add extra space for close date
            if (parsedLine.length === 6) {
                parsedLine.splice(4, 0, 'N/A')
            }
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
    data.forEach(function(v) { 
        outputFile.write(v.join(', ') + '\r\n'); 
    });
    outputFile.end();
}

// const hubFile = fs.readFileSync(`${__dirname}/HUBC137_P530.TXT`, 'utf-8')
// console.log(parseFile(hubFile))
// const parsedData = parseFile(hubFile)
// writeToCSV(parsedData)

    
    
function convertFilesToCSV(fileNames, directory = 'textFiles', ext = 'TXT') {
    fileNames.forEach((fileName) => {
        const hubFile = fs.readFileSync(`${__dirname}/${directory}/${fileName}.${ext}`, 'utf-8')
        const parsedData = parseFile(hubFile)
        debugger
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

// console.log(isDocketNum('EW110073OM'))
convertFilesToCSV(fileNames)


