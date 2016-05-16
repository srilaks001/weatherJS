module.exports = function (app) 
{
    app.get('/currentWeather/:lon/:lat',getCurrentWeatherforCity);
}

var request = require("request");

//Couch db access
var nano = require('nano')('http://localhost:5984');
var weatherdb = nano.db.use('weather'); //database

//URL Strings
var openWeatherAPIKey='81db59a4ba6534eae7b979c59a2356aa';
var currentWeatherURL='http://api.openweathermap.org/data/2.5/weather?';
var authURL='&units=metric&appid='+openWeatherAPIKey;
var lat='lat=';
var lon='&lon=';

/**
* Gets current weather for a city
*/
function getCurrentWeatherforCity(req,res)
{
	weatherdb.get('CurrentWeather', {revs_info: true}, function(err, currentData) 
	{
    	var relevantData = false;
    	var requestTime = Date.now();
    	//looop through all fields in couchdb forecast data to identify if there is relevant data for needed cityID
    	for (curCity in currentData){
    		//check if data exists and it is not outdated
        	if (req.params.lat==currentData[curCity]['lat']&& req.params.lon==currentData[curCity]['lon'] && (requestTime-currentData[curCity]['lastUpdated'])<600000)
			{
        		res.json(currentData[curCity]);
        		relevantData = true;
        	}
        }

        //if there is no relevant data on couchdb, send request to openweathermap 
        if (!relevantData)
		{
        	var currentUrl = currentWeatherURL+lat+req.params.lat+lon+req.params.lon+authURL;
			request(currentUrl, function(error, response, body)
			{
				var city = JSON.parse(body);
				res.json(city);
				currentData[city.id] = city;
				updateWeatherDB(currentData);
			});
        }
    });
}

function updateWeatherDB(currentWeather) 
{
	weatherdb.insert(currentWeather, 'CurrentWeather', function(err, body) {
	if (!err) 
		{
			console.log("Operation successfully performed on Couch DB");
			console.log(body);
		} 
		else 
		{
			console.log("Error when performing operation on Couch DB");
			console.log(err);
		}
	});
}


