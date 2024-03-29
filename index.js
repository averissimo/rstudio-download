const cheerio = require('cheerio')
const fs = require('fs')
const bent = require('bent')
const crypto = require('crypto')
const path = require('path')
const log = require('loglevel')
const execSync = require('child_process').execSync

const opts = require('./config.json');

log.setLevel(opts.log_level ? opts.log_level : "info");

const get = bent('GET', 200);
const down = bent('GET', 'buffer', 200);

async function get_link_scrapper() {

  // download_url = "https://www.rstudio.com/products/rstudio/download/preview/" // old rstudio preview page
  download_url = "https://posit.co/download/rstudio-desktop/"

  const resp = await get(download_url)
  const body = await resp.text()

  const $ = cheerio.load(body)
  let tables = $('.download-table span')

  // Keep only the first row that mentions Ubuntu
  tables = tables.filter((ix, el) => /Ubuntu 22/.test($(el).html())).first()

  // Get the links under that table row
  const links = $(tables.eq(0).next())

  // get link to file
  const href = links.eq(0).prop('href')

  // get sha256 checksum to be used later on
  const sha256 = $(links).next().next().find(".tooltip p").eq(0).html().trim()

  return {
    url: href,
    sha256,
  }
}

async function get_link_json() {
  url = "https://www.rstudio.com/wp-content/downloads.json";
  const resp = await get(url);
  const body = await resp.json();

  const tag = opts.preview ? "preview" : "stable";
  const installers = body.rstudio.open_source[tag].desktop.installer;

  log.debug("tag:", tag);

  const target = Object.values(installers).filter(el => {
    return el.platform.name.match(/Ubuntu/);
  }).at(-1);

  return target;
}

async function download() {
  const url_obj = await get_link_json();

  // Old version used to scrape the download page, but it was deprecated in favor
  //  of using: https://www.rstudio.com/wp-content/downloads.json
  // The code/logic was kept in case this is removed

  // const url_obj = await get_link_scrapper();

  const href = url_obj.url;
  const sha256 = url_obj.sha256;

  log.debug("  href:", href);
  log.debug("sha256:", sha256);

  // Actual download of deb

  if (href === undefined) {
    log.info("The web scrapper couldn't find the link, aborting...")
    return
  }

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
  log.info('Installing debian package, please insert password when asked (or don\'t and install it manually)')
  const cmd = 'sudo dpkg -i -G -E ' + filename
  log.info()
  log.info(cmd)
  execSync(cmd, options = {stdio: 'inherit'});
}

download()
