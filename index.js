const fs = require('fs') 

const hubFile = fs.readFileSync(`${__dirname}/HUBC137_P530.TXT`, 'utf-8')


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

// console.log(isDocketNum('LOBBY DOOR'))
function isBldgId(item) {
    return item.length === 6 && !isNaN(item)
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
    let testingIdx = 0
    let pauseForPageBreak = false
    let currentIdx = 0
    let haveError = false

    file.split('\n').forEach((line, idx) => {
        // if (testingIdx > 2) return
        if (haveError) return
        const parsedLine = line.trim().split(/\s\s+/);

        if (parsedLine[0] === '*** D R A F T') {
            pauseForPageBreak = true;
            return;
        }
        if (pauseForPageBreak) {
            if (parsedLine[0] === '--------------------') {
                pauseForPageBreak = false
            }
            return 
        }
        // there are many blank lines in the doc, ignore them
        if (parsedLine.length === 1) return

    
        if (isBldgId(parsedLine[0])) {
            // testingIdx++
            if (parsedLine.length === 2) {
                currentBaseLine = parsedLine;
                allLines.push(...currentLines)
                currentLines = []
                currentIdx = 0
                addressBreak = true;
                makingLine = true
            } else {
                console.log('error, check line number', idx)
                haveError = true
            }
            return 
        }
    
    
        if (addressBreak) {
            // add to baseline, i.e. finish its second element 
            currentBaseLine[1] += ` ${parsedLine[0]}`.split(',').join('')

            if (parsedLine.length === 9) {
                // if claim is still open, line doesn't have
                // closed date nor Close Code
                parsedLine.splice(8, 0, '999')
                parsedLine.splice(9, 0, 'NONE')

            }
            // if (currentBaseLine[0] === '214433') {
            //     console.log('breaking line')
            //     console.log(parsedLine)
            //     console.log(parsedLine.length)
            //     parsedLine.splice(8, 0, '999')
            //     parsedLine.splice(9, 0, 'NONE')
            //     console.log(parsedLine)
            // } 
            // if (currentBaseLine[0] === '206718') {
            //     console.log('normal line')
            //     console.log(parsedLine)
            //     console.log(parsedLine[9])
            //     console.log(parsedLine.length)
            // }
            // make zip code its own column & add
            // rg & rc count to currentBaseLine
            currentBaseLine = currentBaseLine.concat(parsedLine.slice(1, 4))
            // after basesline (ends idx 3, rc count) add docket info to current line and make docket line
            currentDocketLine = [...currentBaseLine, ...parsedLine.slice(4)]
            // console.log('docket line is', currentDocketLine)
            // currentIdx should be 0
            currentLines[currentIdx] = currentDocketLine
            // console.log('test current lines', currentLines)
            addressBreak = false
            firstDocketLine = true
            return
        }
    
        if (makingLine) {
            // start new line if new docket number
            if (isDocketNum(parsedLine[0])) {
                // console.log('new docket line')
                // means claim is open, so add extra space for 
                if (parsedLine.length === 6) {
                    parsedLine.splice(4, 0, 999)
                }
                currentDocketLine = currentBaseLine.concat(parsedLine)
                currentLines.push(currentDocketLine)
                firstDocketLine = true
                // do docket stuff later
            } else {
                const mcItems = parseMCItems(parsedLine)
                if (firstDocketLine) {
                    // console.log('i shold be called')
                    // console.log('mc itemss', mcItems)
                    // console.log('current line', currentLines[currentIdx])
                    firstDocketLine = false
                    // console.log('currentLines for', currentLines)
                    // console.log(currentIdx)
                    // console.log(idx)
                    // console.log(mcItems)
                    // console.log(currentDocketLine)
                    currentLines[currentIdx] = currentLines[currentIdx].concat(mcItems)
                } else {
                    currentLines.push(currentDocketLine.concat(mcItems))
                }
                currentIdx++
            }
        }
    })
    if (currentLines.length) {
        console.log('leftover lines', currentLines)
        // add remaining lines here
    }
    return allLines
}


function writeToCSV(data) {
    const header = [
        'BLDG ID', 'STREET ADDRESS', 'ZIP CODE', 'LAST REG', 'RC COUNT', 
        'DOCKET NO', 'CASE TYPE', 'CASE STATUS', 'FILING DATE',
        'CLOSING DATE', 'CLOSE CODE', 'STAFF ID', 'MCI ITEM',
        'CLAIM COST', 'ALLOW COST', 'WK BEG DT'
    ]
    const outputFile = fs.createWriteStream("parsedHubData.csv");
    outputFile.on('error', function(err) { console.log('writing error', err)});
    outputFile.write(header.join(', ') + '\r\n')
    data.forEach(function(v) { 
        outputFile.write(v.join(', ') + '\r\n'); 
    });
    outputFile.end();
}

// parseFile(hubFile)

// console.log(parseFile(hubFile))
const parsedData = parseFile(hubFile)
writeToCSV(parsedData)



// fs.readFile(hubFile, (err, data) => { 
//     if (err) throw err; 
  
//     console.log(data.toString()); 
// }) 
// function readTextFile(file) {
//     var rawFile = new XMLHttpRequest();
//     rawFile.open("GET", file, false);
//     rawFile.onreadystatechange = function ()
//     {
//         if(rawFile.readyState === 4)
//         {
//             if(rawFile.status === 200 || rawFile.status == 0)
//             {
//                 var allText = rawFile.responseText;
//                 alert(allText);
//             }
//         }
//     }
//     rawFile.send(null);
// }


// const myFile = readTextFile('/Users/jeremylilly/Documents/javascript/hub_stuff/HUBC137_P530.TXT')
// console.log(myFile)