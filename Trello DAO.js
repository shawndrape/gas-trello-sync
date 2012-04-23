function getTrelloBoards(){
  var URL = constructTrelloURL("members/me/boards") + "&filter=open";
  var resp = UrlFetchApp.fetch(URL);
  var o = Utilities.jsonParse(resp.getContentText());
  return o;
}

function getTrelloBoardByID(boardID){ //TODO add a filters parameter to allow asking for certain fields
  var URL = constructTrelloURL("boards/" + boardID) + "&lists=open";
  var resp = UrlFetchApp.fetch(URL);
  return Utilities.jsonParse(resp.getContentText());
}

function getTrelloListsOfBoard(boardId){
  var URL = constructTrelloURL("boards/"+boardId+"/lists");
  var resp = UrlFetchApp.fetch(URL);
  var o = Utilities.jsonParse(resp.getContentText());
  return o;
}

function constructTrelloURL(baseURL){
  var token = UserProperties.getProperty("trelloOAuthToken");
  return "https://trello.com/1/"+ baseURL +"?key="+ScriptProperties.getProperty("trelloAppKey")+"&token="+token;
}

function createTrelloCard(cardName, cardDesc, listID){
  var url = constructTrelloURL("cards") + "&name=" + encodeURIComponent(cardName) + "&desc=" + encodeURIComponent(cardDesc) + "&idList=" + listID;
  var resp = UrlFetchApp.fetch(url, {"method": "post"});
  return Utilities.jsonParse(resp.getContentText());
}

function addMembersToTrelloCard(cardID, membersList){
  if (typeof membersList === 'string')
    membersList = [ membersList ];
  for (x in membersList){
    var memberID = membersList[x];
    if (memberID === "me")
      memberID = UserProperties.getProperty("trelloMemberID");
    var url = constructTrelloURL("cards/"+cardID+"/members") + "&value=" + memberID;
    var resp = UrlFetchApp.fetch(url, {"method": "post"});
    return Utilities.jsonParse(resp.getContentText());
  }
}

function isTrelloCardClosed(cardID){
  var URL = constructTrelloURL("cards/"+cardID+"/closed");
  var resp = UrlFetchApp.fetch(URL);
  var o = Utilities.jsonParse(resp.getContentText());
  Logger.log("Card " + cardID + " is closed: " + o._value);
  return o._value;
}