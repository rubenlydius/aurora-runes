// enable development helpers by adding ?debug to the URL
export const DEBUG = new URLSearchParams(window.location.search).has('debug');
