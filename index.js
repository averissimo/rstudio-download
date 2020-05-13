const cheerio = require('cheerio')
const fs = require('fs')
const bent = require('bent')
const crypto = require('crypto')
const path = require('path')
const log = require('loglevel')
const execSync = require('child_process').execSync

log.setLevel('info')

download_url = "https://rstudio.com/products/rstudio/download/preview/"

const get = bent('GET', 200);
const down = bent('GET', 'buffer', 200);

async function connect()  {
  const resp = await get(download_url)
  const body = await resp.text()
  
  const $ = cheerio.load(body)
  let tables = $('.col-md-12 table tbody tr')
  
  // Keep only the first row that mentions Ubuntu
  tables = tables.filter((ix, el) => /Ubuntu/.test($(el).html())).first()

  // Get the links under that table row
  const links = $(tables.eq(0)).find('td a')

  // get link to file
  const href = links.eq(0).prop('href')

  // get sha256 checksum to be used later on
  const sha256 = links.eq(1).data('content')
  
  log.debug('href: ', href)
  log.debug('sha256: ', sha256)

  // falg to check if file needs to be downloaded
  let fileExists = false
  // filename to use
  let filename

  // base dir for the downloads folder
  const baseDir = path.join(__dirname, 'downloads')

  // readall files in that folder and remove any that doesn't have same checksum
  fs.readdirSync(baseDir).forEach(file => {
    // content of the file
    const content = fs.readFileSync(path.join(baseDir, file))
    // checksum
    const fileSha256 = crypto.createHash("sha256").update(content).digest("hex")

    // check if it needs to be deleted
    if (fileSha256 !== sha256) {
      fs.unlinkSync(path.join(baseDir, file))
    } else {
      // when file matches checksum from site, then it's the latest one and that
      //  being kept
      fileExists = true
      filename = path.join(baseDir, file)
    }
  })

  // if file exists do nothing
  // otherwise download from link and save to folder
  if (!fileExists) {
    log.debug('Downloading...', baseDir, href)

    // download content
    const content = await down(href)

    // set the filename from link
    filename = path.join(baseDir, path.basename(href))

    // this is for debug, using a cached file
    // const content = fs.readFileSync(path.join(baseDir, 'rstudio-1.3.958-amd64.deb'))
    
    // calculate checksum to compare against value from ite
    const fileSha256 = crypto.createHash("sha256").update(content).digest("hex")

    // if it's the same then it will write the file to disk
    //  otherwise, it does nothing and return an error
    if (fileSha256 === sha256) {
      fs.writeFileSync(filename, content)
    } else {
      log.error('ERROR:: checksum didn\'t match')
      exit(1)
    }
  }

  // outputs the file name
  // log.info(path.join(baseDir, filename))
  log.info()
  log.info('Installing debian package, please insert password when asked')
  const cmd = 'sudo dpkg -i -G -E ' + filename
  log.info()
  log.info(cmd)
  execSync(cmd, options = {stdio: 'inherit'});
}


connect()
