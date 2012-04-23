function onOpen(){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var menuEntries = [{name: "Add a card", functionName: "createCard"},
                     {name: "Configure", functionName: "authorize"},
                     {name: "Load Lists", functionName: "addLists"},
                     {name: "Sync Row", functionName: "sync"}                     
                    ];
  if (Session.getActiveUser().getEmail() === "sdrape@deltahotels.com")
    menuEntries.push({name: "Test", functionName: "testAPI"});
  ss.addMenu("Trello", menuEntries);
  
  var appKey = ScriptProperties.getProperty("trelloAppKey");
  if (appKey === "")
    firstTimeRun();
}

function firstTimeRun(){
  //collect the application key and store it
}

//collects OAuth tokens for the user if they haven't been collected yet
function authorize() {
  var app = UiApp.createApplication();
  var layout = app.createVerticalPanel();
  layout.add(app.createLabel("Clicking the link below will open a window to Trello. Click allow, then copy the access code it gives you into the box below and click save."));
  layout.add(app.createAnchor("Click here to authorize", "https://trello.com/1/authorize?key="+ScriptProperties.getProperty("trelloAppKey")+"&name=My+Application&expiration=never&response_type=token&scope=read,write"));
  var tokenBox = app.createTextBox().setName("token");
  layout.add(tokenBox);
  var clickHandler = app.createServerHandler("saveToken");
  clickHandler.addCallbackElement(tokenBox);
  layout.add(app.createButton("Save Token", clickHandler));
  app.add(layout);
  SpreadsheetApp.getActiveSpreadsheet().show(app);        
}

function saveToken(e){
  var app = UiApp.getActiveApplication();
  UserProperties.setProperty("trelloOAuthToken", e.parameter.token);
  
  //get memberID as well
  var URL = "https://trello.com/1/members/me?key="+ScriptProperties.getProperty("trelloAppKey")+"&token="+e.parameter.token;
  var resp = UrlFetchApp.fetch(URL);
  var o = Utilities.jsonParse(resp.getContentText());
  if (!UserProperties.getProperty("trelloMemberID"))
    UserProperties.setProperty("trelloMemberID", o.id);
  app.close();
  return app;
}
//END AUTHORIZE FLOW

function testAPI(){
  sync();
  var app = UiApp.createApplication();
  var selectList = app.createListBox().setName("board");
  var o = getTrelloBoards();
  for (x in o){
    selectList.addItem(o[x].name, o[x].id); 
  }
  app.add(selectList);
  var changeHandler = app.createServerHandler("TEST_LOOKUP");
  selectList.addChangeHandler(changeHandler);
  app.add(app.createTextArea().setName("content").setId("content"));
  SpreadsheetApp.getActiveSpreadsheet().show(app);
}

function TEST_LOOKUP(e){

}

//create card
function createCard(){
  var app = UiApp.createApplication();
  var layout = app.createVerticalPanel();
  layout.add(app.createLabel("Card Title"));
  layout.add(app.createTextBox().setName("cardTitle"));
  layout.add(app.createCheckBox("Add as Member").setValue(true, false).setName("addAsMember"));
  layout.add(app.createLabel("Card Description (optional)"));
  layout.add(app.createTextArea().setName("cardDescription"));
  //let users pick the main card table
  layout.add(app.createLabel("Select a board and list to host the primary card"));
  var o = getTrelloBoards();
  var boardLayout = app.createHorizontalPanel();
  layout.add(boardLayout);
  var selectList = app.createListBox().setName("board").addItem("");
  for (var x in o){
    var boardId = o[x].id;
    var boardName = o[x].name;
    selectList.addItem(boardName, boardId);
  }
  boardLayout.add(selectList);
  var selectHandler = app.createServerHandler("addListsOfBoard");
  var listPanel = app.createListBox().setId("listPanel").setName("list");
  selectList.addChangeHandler(selectHandler);
  boardLayout.add(listPanel);
  
  
  //get all available lists
  var range = getLists();
  layout.add(app.createLabel("Select lists to push to:"));
  var selectAllButton = app.createButton("Select All");
  layout.add(selectAllButton);
  var checkboxes = app.createFlowPanel().setId("checkboxes");
  var widgetList = [];
  for (x in range){
    var cbox = app.createCheckBox(range[x].name).setFormValue(range[x].id).setName(range[x].name).setId(range[x].id);
    widgetList.push(cbox);
    checkboxes.add(cbox);
  }
  layout.add(checkboxes);
  Logger.log(widgetList);
  var selectAllHandler = app.createServerHandler("selectAllLists").addCallbackElement(checkboxes);
  selectAllButton.addClickHandler(selectAllHandler);
  var serverHandler = app.createServerHandler("addCardsToLists").addCallbackElement(layout).addCallbackElement(checkboxes);
  layout.add(app.createButton("Go").addClickHandler(serverHandler));
  app.add(layout);
  SpreadsheetApp.getActiveSpreadsheet().show(app);
}

//selects all the children checkboxes
//to be replaces when client handler works
function selectAllLists(e){
  var app = UiApp.getActiveApplication();
  var lists = getLists();
  for (x in lists){
    var cbox = app.getElementById(lists[x].id);
    cbox.setValue(true);
  }
  return app;
}

function addCardsToLists(e){
  for (x in e.parameter) Logger.log(x + ": " + e.parameter[x]);
  var validLists = getLists();
  var cardName = e.parameter.cardTitle;
  var cardDesc = e.parameter.cardDescription;
  
  var mainBoardId = e.parameter.board;// needed?
  var mainListId = e.parameter.list;
  var boardObj = getTrelloBoardByID(mainBoardId);
  
  
  var ss = SpreadsheetApp.getActive();
  //temp
  var rowCount = ss.getSheetByName("Task Status").getLastRow() + 1;
  
  var mainCardObj = createTrelloCard(cardName, "SYNCED CARD: Control from [here](" + SpreadsheetApp.getActive().getUrl() + ")\n\n" + cardDesc, mainListId);
  var rowObject = [cardName, mainCardObj.id, mainCardObj.url, mainListId, mainBoardId, ""]; //last item is checklist - TBI
  var taskTrackObj = [cardName, mainCardObj.id, "",""]; //formula added below
  
  var pushedDesc = cardDesc + "\n\nThis card was pushed from [here](" + mainCardObj.url + ")";
  
  var addAsMember = e.parameter.addAsMember;
  var memberID = UserProperties.getProperty("trelloMemberID");
  for (x in validLists){
    if (e.parameter[x] !== "true"){ 
      rowObject.push("");
      taskTrackObj.push("");
      continue;
    }
    var card = createTrelloCard(cardName, pushedDesc, validLists[x].id);
    rowObject.push(card.id);
    taskTrackObj.push("OPEN");
    if (addAsMember === "true"){ //only add as a member if requested
      addMembersToTrelloCard(card.id, "me");
    }
  }
  
  ss.getSheetByName("Tracked Cards").appendRow(rowObject);
  ss.getSheetByName("Task Status").appendRow(taskTrackObj);
  var formula = '=countif(E'+rowCount+':'+rowCount+',"CLOSED")/counta(E'+rowCount+':'+rowCount+')';
  ss.getSheetByName("Task Status").getRange(rowCount, 4).setFormula(formula);
  return UiApp.getActiveApplication().close();
}
//END CREATE CARD

//add Lists
function addLists(){
  var app = UiApp.createApplication();
  var o = getTrelloBoards();
  var selectList = app.createListBox().setName("board");
  for (var x in o){
    var boardId = o[x].id;
    var boardName = o[x].name;
    selectList.addItem(boardName, boardId);
  }
  app.add(selectList);
  var selectHandler = app.createServerHandler("addListsOfBoard");
  var listPanel = app.createListBox(true).setId("listPanel").setName("lists");
  selectList.addChangeHandler(selectHandler);
  var buttonHandler = app.createServerHandler("saveLists").addCallbackElement(selectList).addCallbackElement(listPanel);
  var button = app.createButton("Save Lists", buttonHandler);
  
  app.add(listPanel);
  app.add(button);
  SpreadsheetApp.getActiveSpreadsheet().show(app);
}

function addListsOfBoard(e){
  var o = getTrelloListsOfBoard(e.parameter.board);
  var app = UiApp.getActiveApplication();
  var listPanel;
  
  try{
    listPanel = app.getElementById("listPanel");
    listPanel.clear();
  } catch (exception){
    listPanel = app.createListBox(true).setId("listPanel");
    app.add(listPanel);
  }
  Logger.log(listPanel);
  for (var x in o){
    var listName = o[x].name;
    var listId = o[x].id;
    listPanel.addItem(listName, listId);
  }
  
  return app;
}

function saveLists(e){
  var app = UiApp.getActiveApplication();
  var boardId = e.parameter.board;
  var boardObj = getTrelloBoardByID(boardId);
  var lists = e.parameter.lists;
  var listOfLists = lists.split(",");
  var boardLists = boardObj.lists;
  Logger.log(boardObj);
  
  //populate the spreadsheet
  var sheet = SpreadsheetApp.getActive().getSheetByName("Lists");
  for (var x in boardLists){
    Logger.log(boardLists[x]);
    Logger.log("--------");
    if (listOfLists.indexOf(boardLists[x].name) === -1) continue; //if the board list wasn't selected, move on
    
    sheet.appendRow([boardLists[x].name, boardObj.url, boardLists[x].id]);
  }
  app.close();
  return app;
}
//END ADD LISTS FLOW

//sync card status
function sync(){
  //see which row is selected
  var range = SpreadsheetApp.getActiveRange();
  if (range.getHeight() > 1)
    throw new Error("Can only sync a single row at a time. Please select just one row.");
  var dataRange = range.getValues();
  //find card list in tracking data
  var origCardID = dataRange[0][1];
  var pushedCards = getPushedCards(origCardID);
  Logger.log(pushedCards);
  //for each pushed card, check if it is closed
  var result = []; result[0] = [];
  for (var x in pushedCards){
    if (pushedCards[x] === ""){ 
      continue;
    }
    //if closed, push "CLOSED" to array. Else, push open
    if (isTrelloCardClosed(pushedCards[x])){
      result[0].push("CLOSED");
    }
    else {
      result[0].push("OPEN");
    }
  } 
  //set array down to selected row
  
  Logger.log(result);
  SpreadsheetApp.getActiveSheet().getRange(range.getRow(), 3).setValue(new Date());
  SpreadsheetApp.getActiveSheet().getRange(range.getRow(), 5, 1, result[0].length).setValues(result);
}