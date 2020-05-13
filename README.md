## RStudio downloader

> download and install latest rstudio preview

This works by scrapping the [download page](https://www.rstudio.com/products/rstudio/download/preview/) and finding the Ubuntu installer.

It then uses `dpkg` to install the `.deb` file.

_note:_ It keeps the latest deb in the downloads folder and every time it runs it deletes any other file there by using the checksum to keep only the latest version.

## Instructions

You need to have node installed, then:

```
$ git clone https://github.com/averissimo/rstudio-download
$ cd rstudio-download
$ npm install
$ npm start
```

That's it
