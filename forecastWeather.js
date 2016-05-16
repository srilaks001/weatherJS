module.exports = function (app) 
{
    app.get('/forecastWeather/:lon/:lat', getForecastData);
}

var request = require("request");

//Couch db access
var nano = require('nano')('http://localhost:5984');
var weatherdb = nano.db.use('weather'); //database

//URL Strings
var openWeatherAPIKey='81db59a4ba6534eae7b979c59a2356aa';
var forecastWeatherURL = 'http://api.openweathermap.org/data/2.5/forecast?'
var authURL='&units=metric&appid='+openWeatherAPIKey;
var lat='lat=';
var lon='&lon=';

/**
* Get the forecast data for a particular city
*/
function getForecastData (req,res)
{
	weatherdb.get('ForecastWeather', {revs_info: true}, function(err, forecastData) 
	{
    	var relevantData = false;
    	var requestTime = Date.now();
    	//looop through all fields in couchdb forecast data to identify if there is relevant data for needed cityID
    	for (curCity in forecastData){
    		//check if data exists and it is not outdated
        	if (curCity == req.params.cityID && (requestTime-forecastData[curCity]['lastUpdated'])<600000){
        		res.json(forecastData[curCity]);
        		relevantData = true;
        	}
        }

        //if there is no relevant data on couchdb, send request to openweathermap 
        if (!relevantData)
		{
        	var currentUrl = forecastWeatherURL+lat+req.params.lat+lon+req.params.lon+authURL;
			request(currentUrl, function(error, response, body)
			{
				cityForecast = parseOpenWMForecastData(JSON.parse(body));
				res.json(cityForecast);
				forecastData[cityForecast.id] = cityForecast;
				updateWeatherDBWithForecast(forecastData);
			});
        }
    });
}

function updateWeatherDBWithForecast(forecastData) {
	weatherdb.insert(forecastData, 'ForecastWeather', function(err, body) {
	if (!err) {
			console.log("Operation successfully performed on Couch DB");
			console.log(body);
		} else {
			console.log("Error when performing operation on Couch DB");
			console.log(err);
		}
	});
}

/**
* Parse data from OpenWm format to custom format suitable for further rendering
*/
function parseOpenWMForecastData(inData)
{
	var cityForecast = {};
	cityForecast.id = inData.city.id;
	cityForecast.name = inData.city.name;
	cityForecast.coord = inData.city.coord;
	cityForecast.country = inData.city.country;
	cityForecast.lastUpdated = Date.now();

	//parsing data for the one day 3 hour breakdown forecast
	cityForecast.dayForecast = [];
	for (var i=0;i<9;i++){
		var hourForecast = {};

		hourForecast.dateTimeTXT = inData.list[i].dt_txt;
		hourForecast.temperature = inData.list[i].main.temp;
		hourForecast.pressure = inData.list[i].main.pressure;
		hourForecast.humidity = inData.list[i].main.humidity;
		hourForecast.windSpeed = inData.list[i].wind.speed;
		hourForecast.description = inData.list[i].weather[0].description;
		hourForecast.icon = inData.list[i].weather[0].icon;

		cityForecast.dayForecast.push(hourForecast);
	}
	
	//parsing data into 5 day avg format
	cityForecast.fiveDayForecast = [];

	//initialising starting values for calculation variables
	var fullday = false;
	for (var j=0;j<inData.list.length;j++){
		//if it a beginning of a new day, the parameter arrays are reset
		if (inData.list[j].dt_txt.split(" ")[1] == '00:00:00'){
			fullday = true;
			var dayTemperature = [inData.list[j].main.temp];
			var dayHumidity = [inData.list[j].main.humidity];
			var dayPressure = [inData.list[j].main.pressure];
			var dayWindSpeed = [inData.list[j].wind.speed];
		//if it is the end of a day with a full dataset, the min and max values are added to the dayForecast object
		}else if(inData.list[j].dt_txt.split(" ")[1] == '21:00:00' && fullday){
			//update the arrays first
			dayTemperature.push(inData.list[j].main.temp);
			dayHumidity.push(inData.list[j].main.humidity);
			dayPressure.push(inData.list[j].main.pressure);
			dayWindSpeed.push(inData.list[j].wind.speed);

			var dayForecast = {};

			dayForecast.dateTXT = inData.list[j].dt_txt.split(" ")[0];
			//calculate the min and max values
			dayForecast.temperatureMax = Math.max.apply(Math,dayTemperature);
			dayForecast.temperatureMin = Math.min.apply(Math,dayTemperature);
			dayForecast.pressureMax = Math.max.apply(Math,dayPressure);
			dayForecast.pressureMin = Math.min.apply(Math,dayPressure);
			dayForecast.humidityMax = Math.max.apply(Math,dayHumidity);
			dayForecast.humidityMin = Math.min.apply(Math,dayHumidity);
			dayForecast.windSpeedMax = Math.max.apply(Math,dayWindSpeed);
			dayForecast.windSpeedMin = Math.min.apply(Math,dayWindSpeed);

			cityForecast.fiveDayForecast.push(dayForecast);

		//otherwise the arrays are updated
		}else if(fullday){
			dayTemperature.push(inData.list[j].main.temp);
			dayHumidity.push(inData.list[j].main.humidity);
			dayPressure.push(inData.list[j].main.pressure);
			dayWindSpeed.push(inData.list[j].wind.speed);
		}
	}
	return cityForecast;
}