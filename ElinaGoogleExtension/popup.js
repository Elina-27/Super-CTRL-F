document.addEventListener("DOMContentLoaded", () => {
    console.log("Popup loaded");
    
    // Store total matches count
    let totalMatches = 0;
    let currentPosition = 0;
    let searchStartTime = 0;
    
    // Function to update match position display
    function updateMatchPosition(current, total) {
        const positionElement = document.getElementById("match-position");
        if (positionElement) {
            positionElement.textContent = `${current}/${total}`;
        }
    }

    // Function to update timer display
    function updateTimerDisplay(duration) {
        const timerElement = document.getElementById("search-timer");
        if (timerElement) {
            timerElement.textContent = `${duration.toFixed(2)}s`;
        }
    }

    // Function to show/hide spinner
    function toggleSpinner(show) {
        const spinner = document.getElementById("search-spinner");
        if (spinner) {
            spinner.style.display = show ? "block" : "none";
        }
    }

    // Function to reset everything to initial state
    function resetToInitialState() {
        // Reset input fields
        document.getElementById("word1").value = "";
        document.getElementById("charGap").value = "20";
        document.getElementById("word2").value = "";
        
        // Reset variables
        totalMatches = 0;
        currentPosition = 0;
        searchStartTime = 0;
        
        // Reset displays
        updateMatchPosition(0, 0);
        updateTimerDisplay(0);
        toggleSpinner(false);
    }
    
    document.getElementById("search").addEventListener("click", async () => {
        try {
            // Start timer and show spinner
            searchStartTime = performance.now();
            toggleSpinner(true);
            
            let word1 = document.getElementById("word1").value.trim();
            let charGapInput = document.getElementById("charGap").value.trim();
            let charGap = charGapInput === "" || isNaN(parseInt(charGapInput, 10)) || parseInt(charGapInput, 10) < 0
                ? 20
                : parseInt(charGapInput, 10);
            let word2 = document.getElementById("word2").value.trim();
            console.log("Search clicked with:", { word1, charGap, word2 });
            
            if (!word1 || !word2 || isNaN(charGap) || charGap < 0) {
                alert("Please enter valid words and a positive number.");
                toggleSpinner(false);
                return;
            }

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            console.log("Found active tab:", tab.id);

            // First, inject the content script
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => {
                    window.matches = [];
                    window.currentMatchIndex = -1;
                }
            });

            // Then execute the search
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: findAndHighlight,
                args: [word1, charGap, word2]
            });

            // Calculate and display search duration
            const searchDuration = (performance.now() - searchStartTime) / 1000;
            updateTimerDisplay(searchDuration);
            toggleSpinner(false);

            console.log("Search results:", results);
            
            // Store total matches and update position
            if (results && results[0] && results[0].result) {
                totalMatches = results[0].result;
                currentPosition = 1;
                updateMatchPosition(currentPosition, totalMatches);
            }
        } catch (error) {
            console.error("Error during search:", error);
            alert("An error occurred during the search. Please try again.");
            toggleSpinner(false);
        }
    });

    document.getElementById("clear").addEventListener("click", async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => {
                    document.querySelectorAll(".highlighted").forEach(el => {
                        el.outerHTML = el.textContent;
                    });
                    window.matches = [];
                    window.currentMatchIndex = -1;
                }
            });
            
            // Reset everything to initial state
            resetToInitialState();
        } catch (error) {
            console.error("Error clearing highlights:", error);
        }
    });

    document.getElementById("prev").addEventListener("click", async () => {
        try {
            if (totalMatches === 0) return;
            
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: navigateToMatch,
                args: ["prev"]
            });
            
            // Update position only, keep totalMatches the same
            currentPosition = currentPosition > 1 ? currentPosition - 1 : totalMatches;
            updateMatchPosition(currentPosition, totalMatches);
        } catch (error) {
            console.error("Error navigating previous:", error);
        }
    });

    document.getElementById("next").addEventListener("click", async () => {
        try {
            if (totalMatches === 0) return;
            
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: navigateToMatch,
                args: ["next"]
            });
            
            // Update position only, keep totalMatches the same
            currentPosition = currentPosition < totalMatches ? currentPosition + 1 : 1;
            updateMatchPosition(currentPosition, totalMatches);
        } catch (error) {
            console.error("Error navigating next:", error);
        }
    });
});

function findAndHighlight(word1, charGap, word2) {
    console.log("Starting search with:", { word1, charGap, word2 });
    
    // Clear previous highlights
    document.querySelectorAll(".highlighted").forEach(el => {
        el.outerHTML = el.textContent;
    });

    let regex = new RegExp(`${word1}(.{0,${charGap}}?)${word2}`, "gi");
    console.log("Using regex:", regex);
    
    let walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let nodes = [];
    let matchCount = 0;

    // First, collect all text nodes
    while (walker.nextNode()) {
        nodes.push(walker.currentNode);
    }
    console.log("Found text nodes:", nodes.length);

    // Process each node and count matches
    nodes.forEach(node => {
        let text = node.nodeValue;
        let match;
        let lastIndex = 0;
        let newHTML = "";

        // Reset regex for this node
        regex.lastIndex = 0;

        while ((match = regex.exec(text)) !== null) {
            console.log("Found match:", match[0]);
            newHTML += text.slice(lastIndex, match.index);
            newHTML += `<span class='highlighted' data-match-index='${matchCount}' style='background-color: yellow;'>${match[0]}</span>`;
            lastIndex = match.index + match[0].length;
            matchCount++;
        }

        newHTML += text.slice(lastIndex);

        if (newHTML !== text) {
            let span = document.createElement("span");
            span.innerHTML = newHTML;
            node.parentNode.replaceChild(span, node);
        }
    });

    console.log("Total matches found:", matchCount);

    // Store the current match index
    window.currentMatchIndex = 0;
    
    // Highlight the first match if any
    if (matchCount > 0) {
        const firstMatch = document.querySelector(`.highlighted[data-match-index='0']`);
        if (firstMatch) {
            firstMatch.style.backgroundColor = "orange"; // Orange color for current match
            firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // Update the match count in the popup
    const matchPosition = document.getElementById("match-position");
    if (matchPosition) {
        matchPosition.textContent = `1/${matchCount}`;
    }

    return matchCount;
}

function navigateToMatch(direction) {
    const matches = document.querySelectorAll(".highlighted");
    if (matches.length === 0) return;

    // Reset all matches to yellow
    matches.forEach(match => {
        match.style.backgroundColor = "yellow";
    });

    // Update current index
    if (direction === "next") {
        window.currentMatchIndex = (window.currentMatchIndex + 1) % matches.length;
    } else {
        window.currentMatchIndex = (window.currentMatchIndex - 1 + matches.length) % matches.length;
    }

    // Highlight the current match in orange
    const currentMatch = document.querySelector(`.highlighted[data-match-index='${window.currentMatchIndex}']`);
    if (currentMatch) {
        currentMatch.style.backgroundColor = "orange"; 
        currentMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

chrome.runtime.onMessage.addListener((message) => {
    console.log("Received message:", message);
    if (message.action === "updateMatchCount") {
        console.log("Updating match count to:", message.count);
        const matchCount = document.getElementById("match-count");
        matchCount.textContent = message.count;
    }
});
