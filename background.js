const BLACKLISTED_PARAMS = ['utm_','clid'];

async function askAlgolia(url) {
  // handle special case of www/no-www versions
  // here because it helps find more results but it's not strictly url canonicalization,
  // so results without www will eventually show up as "related url"
  url = url.startsWith('www.') ? url.replace(/www\./,'') : url;

  url = encodeURIComponent(url);
  let res = await fetch(`https://hn.algolia.com/api/v1/search?query=${url}&restrictSearchableAttributes=url&analytics=false`);
  let data = await res.json();
  return data;
}

function cleanUpParameters(url) {
  const urlObj = new URL(url);
  const params = urlObj.searchParams;
  const blacklistedKeys = []

  for (const key of params.keys()){
    if (BLACKLISTED_PARAMS.some((entry) => key.includes(entry))){
      // Can't delete directly since it will mess up the iterator order
      // Saving it temporarily to delete later
      blacklistedKeys.push(key)
    }
  }

  for (const key of blacklistedKeys){
    params.delete(key)
  }

  // Reconstruct search params after cleaning up
  urlObj.search = params.toString()

  return urlObj.toString()
}

function cleanUrl(url) {
  // (maybe) clean up analytics-related params
  url = (url.includes('?')) ? cleanUpParameters(url) : url;
  // strip protocol for better results
  url = url.replace(/(^\w+:|^)\/\//, '');
  // also, strip anchors
  url = url.replace(/(#.+?)$/, '');
  // also, strip index.php/html
  url = url.replace(/index\.(php|html?)/, '');
  // also, strip single leading slash, e.g. example.com/ -> example.com
  url = (url.endsWith("/") && url.split("/").length < 3) ? url.replace(/\/+$/, '') : url;
  return url;
}









// chrome.webNavigation.onCompleted.addListener(onTabLoad);


let COUNTS = {};


// fires when tab is updated
chrome.tabs.onUpdated.addListener(onTabLoad);

// fires when active tab changes
chrome.tabs.onActivated.addListener(onTabLoad);



async function getCurrentTab() {
  let queryOptions = { active: true, lastFocusedWindow: true };
  // `tab` will either be a `tabs.Tab` instance or `undefined`.
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}


function onTabLoad(tab) {
  getCurrentTab().then((tab) => {
    if (!tab.url) {
      return;
    }
    if (!tab.id) {
      return;
    }

    // If we have already seen this URL, just fetch the count
    if (tab.url in COUNTS) {
      setBadge(COUNTS[tab.url]);
      return;
    }
    else {
      COUNTS[tab.url] = 0;
    }

    if ( new RegExp('^https?://.+$').test(tab.url) ) {
      _cleanUrl = cleanUrl(tab.url);

      console.log("fetching algolia for " + _cleanUrl);
      askAlgolia(_cleanUrl)
          .then((data) => updateBadge(data, tab.id, tab.url))
          .catch((error) => console.error(error))
          .finally(() => console.log("done fetching algolia for " + _cleanUrl));
    }
  });
}

function setBadge(count, tabId) {
  var text = "";
  if (count > 0) {
    text = count.toString();
  }
  console.log("Update badge with " + text);
  chrome.action.setBadgeText({text: text, tabId: tabId});
  chrome.action.setBadgeBackgroundColor({color: '#666666'});
}

function updateBadge(data, tabId, tabUrl) {
  let count = 0;

  // Compute number for badge for current tab's url
  if (data && data.nbHits > 0) {
    count = data.hits[0].points;
  }

  COUNTS[tabUrl] = count;
  setBadge(count, tabId);
}
