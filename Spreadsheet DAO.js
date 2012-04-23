function getLists(){
  var sheet = SpreadsheetApp.getActive().getRange("Lists!A2:C").getValues();
  var result = {};
  for (x in sheet){
    if (sheet[x][0] === "") 
      break;//at this point, the list of lists is finished
    var list = {};
    list.name = sheet[x][0];
    list.boardUrl = sheet[x][1];
    list.id = sheet[x][2];
    result[list.name] = list;
  }
  return result;
}

function getPushedCards(origID){
  var result = [];
  var sheet = SpreadsheetApp.getActive().getSheetByName("Tracked Cards");
  var rangeData = sheet.getDataRange().getValues();
  for (var x = 1; x < rangeData.length; x++){
    if (rangeData[x][1] === origID)
      return rangeData[x].splice(6)
  }
}