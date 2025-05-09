document.addEventListener('keydown', function(event) {
    if (event.ctrlKey && event.key === 'f') {
      event.preventDefault();
  
      let searchTerm = prompt('Enter search term:');
      if (searchTerm) {
        let bodyText = document.body.innerText;
        let foundIndex = bodyText.indexOf(searchTerm);
  
        if (foundIndex !== -1) {
          alert('Found: ' + searchTerm);
        } else {
          alert('No match found.');
        }
      }
    }
  });
  


  