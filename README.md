# Personal Page

This repo holds my [portfolio webpage](https://matthewscholefield.github.io/) which is a customized instance of [OpenSpace](https://github.com/EverythingMe/openspace), a GitHub portfolio webpage. Beyond generating user specific info, the customizations are as follows:

 - Titles are space separated and capitalized
 - Special characters are escaped in tab filters (fixes C++ filter)
 - Added support for Material Icons

## Development

Setup and view the page locally with a simple web server:

```bash
git clone https://github.com/MatthewScholefield/matthewscholefield.github.io/
cd matthewscholefield.github.io
python3 -m http.server 8080
```
