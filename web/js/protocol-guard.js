(() => {
  const { location } = window;
  if (location.protocol !== 'file:') return;

  const target = new URL('http://127.0.0.1:3030/');
  target.search = location.search;
  target.hash = location.hash;
  location.replace(target.toString());
})();
