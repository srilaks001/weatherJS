module.exports = function (app) 
{
    app.get('/getFavCities/:userID', getFavCities);
	app.get('/removeFavCity/:cityID/:userID', removeFavCity);
	app.post('/addFavCity/:lon/:lat/:userID', addFavCity);

}

var request = require("request");

//Couch db access
var nano = require('nano')('http://localhost:5984');
var weatherdb = nano.db.use('weather'); //database

//function returns JSON object with user fav cities based on user id in req.params
function getFavCities(req,res){
	weatherdb.get('UserPreferences', {revs_info: true}, function(err, userData) {
    	if (!err) {
    		var userFavCities;
    		if (Object.keys(userData).indexOf(req.params.userID)==(-1)){
    			userData[req.params.userID]={'userFavCities':{}};
    			updateUserDB(userData);
    		}
    		res.send(userData[req.params.userID]["userFavCities"]);
        }
    });
}

//function deletes a city from user fav cities based on city id and user id in req.params
function removeFavCity(req,res){
	weatherdb.get('UserPreferences', {revs_info: true}, function(err, userData) {
    	if (!err) {
    		delete userData[req.params.userID]["userFavCities"][req.params.cityID];
	        weatherdb.insert(userData, 'UserPreferences', function(err, t) {
	            res.send('City removed');
	        });
        }
    });
}

//function adds a favourite city based on the current coordinates
function addFavCity(req,res)
{
	debugger;
	var openWeatherAPIKey='81db59a4ba6534eae7b979c59a2356aa';
	var currentWeatherURL='http://api.openweathermap.org/data/2.5/weather?';
	var authURL='&units=metric&appid='+openWeatherAPIKey;
	var lat='lat=';
	var lon='&lon=';
	weatherdb.get('UserPreferences', {revs_info: true}, function(err, userData) 
	{
		var currentUrl = currentWeatherURL+lat+req.params.lat+lon+req.params.lon+authURL;
		request(currentUrl, function(error, response, body)
		{
			var length=0;
			var currentCity={};
			var temp=JSON.parse(body);
			currentCity.id=temp.id;
			currentCity.name=temp.name;
			currentCity.country=temp.sys.country;
			currentCity.coord=temp.coord;
			
			if(userData[req.params.userID]['userFavCities'].length)
				{
					//retrieve next available id. If array has index 0,1 , then length will be 2
					length=userData[req.params.userID]['userFavCities'].length;
				}
				else
				{
					userData[req.params.userID]['userFavCities']=[];
				}
			
			
			//res.json(currentCity);
			if (!err) 
			{
				/*if (Object.keys(userData[req.params.userID]['userFavCities']).indexOf(req.params.lon)>=0
				&& Object.keys(userData[req.params.userID]['userFavCities']).indexOf(req.params.lat)>=0)
				{
					res.send('City already in list');			
				}
				else
				{*/
					debugger;
					
					userData[req.params.userID]['userFavCities'][length] = currentCity;
					updateUserDB(userData);
					res.send('City added');
				//}
			}  	  	
        });
    });
}

function updateUserDB(userData) {
	weatherdb.insert(userData, 'UserPreferences', function(err, body) {
	if (!err) {
			console.log("User data successfully updated on Couch DB");
			console.log(body);
		} else {
			console.log("Error when updating user data on Couch DB");
			console.log(err);
		}
	});
}

