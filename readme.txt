Project structure is as follows:
C++ code will be compiled as a library

Wink Detection:
A seperate backend using Flask allows wink algorithm to be used as an
API endpoint. The Next.js frontend communicates with backend via HTTP requests.

For speed, utilizing MediaPipe's JavaScript API allows for direct processing of 
webcam input





****Before running, update your dependencies ***

(1)
npm install -g npm@latest
(if on mac) sudo npm install -g npm@latest

(2)
update node
https://nodejs.org/

(3)
update all globally installed packages
npm update -g

(4)
update git
https://git-scm.com/downloads


Instructions to run:
(1) Install project dependencies
  npm i

(2) Install react app dependencies
  cd client
  npm i

(3) build the react app and run electron
  npm start

