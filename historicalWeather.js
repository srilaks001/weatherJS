module.exports = function (app) 
{
    app.get('/historicalWeather/:lon/:lat',getHistoricalData)
}

var request = require("request");
const kelvinToCelsius = require('kelvin-to-celsius');

//Couch db access
var nano = require('nano')('http://localhost:5984');
var weatherdb = nano.db.use('weather'); //database

//URL Strings
var openWeatherAPIKey='81db59a4ba6534eae7b979c59a2356aa';
var authURL='&units=metric&appid='+openWeatherAPIKey;
var currentWeatherURL='http://api.openweathermap.org/data/2.5/weather?';
var historyWeatherURL='http://api.openweathermap.org/data/2.1/history/city/';
var lat='lat=';
var lon='&lon=';
var start='&start=';
var end='&end=';
var historyType='&type=day';

/**
* Historical data
*/
function getHistoricalData(req,res)
{
	weatherdb.get('HistoricalWeather', {revs_info: true}, function(err, historicalData) 
	{
    	var relevantData = false;
    	var requestTime = Date.now();
    	//looop through all fields in couchdb forecast data to identify if there is relevant data for needed cityID
    	for (curCity in historicalData){
    		//check if data exists and it is not outdated
        	if (req.params.lat==historicalData[curCity]['lat']&& req.params.lon==historicalData[curCity]['lon'] && (requestTime-historicalData[curCity]['lastUpdated'])<600000){
        		res.json(historicalData[curCity]);
        		relevantData = true;
        	}
        }

        //if there is no relevant data on couchdb, send request to openweathermap 
        if (!relevantData)
		{
			var endTimeStamp= Date.now();
			var startTimeStamp=new Date();
			var currentDate=new Date(endTimeStamp);
			startTimeStamp.setDate(currentDate.getDate()-20);
			//startTimeStamp/1000= 1462901321
			//endtimeStamp/1000=1463160521
			
			//find city id from latitude and longitude
			var currentUrl = currentWeatherURL+lat+req.params.lat+lon+req.params.lon+authURL;
			request(currentUrl, function(err, resp, data)
			{
				var cityID=JSON.parse(data).id;
				currentUrl = historyWeatherURL+cityID+'?'+historyType+authURL+start+Math.floor(startTimeStamp/1000)+end+Math.floor(endTimeStamp/1000);
				request(currentUrl, function(error, response, body)
				{
					debugger;
					cityHistory = parseOpenWMHistoricalData(JSON.parse(body));
					res.json(cityHistory);
					historicalData[cityHistory.id] = cityHistory;
					updateWeatherDBWithHistory(historicalData);
				});
				
			});
			
        	
        }
    });
}

function updateWeatherDBWithHistory(historicalData) {
	weatherdb.insert(historicalData, 'HistoricalWeather', function(err, body) {
	if (!err) {
			console.log("Operation successfully performed on Couch DB");
			console.log(body);
		} else {
			console.log("Error when performing operation on Couch DB");
			console.log(err);
		}
	});
}
function parseOpenWMHistoricalData(inData)
{
	var cityHistory = {};
	cityHistory.id = inData.city_id;
	cityHistory.lastUpdated = Date.now();
	
	cityHistory.temperatureMax={};
	cityHistory.temperatureMin={};
	
	cityHistory.pressureMax={};
	cityHistory.pressureMin={};
	
	cityHistory.humidityMax={};
	cityHistory.humidityMin={};
	
	cityHistory.windSpeedMax={};
	cityHistory.windSpeedMin={};
	
	//Temperature Max
	cityHistory.temperatureMax.value=Math.max.apply(Math,inData.list.map(function(city)
	{
		return city.main.temp;
	}))
	var timestamp={};
	timestamp=inData.list.find(function(o){ return o.main.temp == cityHistory.temperatureMax.value; }).dt ;
	cityHistory.temperatureMax.timestamp=new Date(timestamp*1000).toLocaleDateString();
	cityHistory.temperatureMax.value=kelvinToCelsius(cityHistory.temperatureMax.value);
	
	
	//Temperature Min
	cityHistory.temperatureMin.value=Math.min.apply(Math,inData.list.map(function(city)
	{
		return city.main.temp;
	}))
	timestamp = inData.list.find(function(o){ return o.main.temp == cityHistory.temperatureMin.value; }).dt;
	cityHistory.temperatureMin.timestamp=new Date(timestamp*1000).toLocaleDateString();
	cityHistory.temperatureMin.value=kelvinToCelsius(cityHistory.temperatureMin.value);
	
	//Pressure Max
	cityHistory.pressureMax.value=Math.max.apply(Math,inData.list.map(function(city)
	{
		return city.main.pressure;
	}))
	timestamp=inData.list.find(function(o){ return o.main.pressure == cityHistory.pressureMax.value; }).dt;
	cityHistory.pressureMax.timestamp=new Date(timestamp*1000).toLocaleDateString();
	
	//Pressure Min
	cityHistory.pressureMin.value=Math.min.apply(Math,inData.list.map(function(city)
	{
		return city.main.pressure;
	}))
	timestamp=inData.list.find(function(o){ return o.main.pressure == cityHistory.pressureMin.value; }).dt;
	cityHistory.pressureMin.timestamp=new Date(timestamp*1000).toLocaleDateString();
	
	//Humidity Max
	cityHistory.humidityMax.value=Math.max.apply(Math,inData.list.map(function(city)
	{
		return city.main.humidity;
	}))
	timestamp=inData.list.find(function(o){ return o.main.humidity == cityHistory.humidityMax.value; }).dt;
	cityHistory.humidityMax.timestamp=new Date(timestamp*1000).toLocaleDateString();
	
	//Humidity Min
	cityHistory.humidityMin.value=Math.min.apply(Math,inData.list.map(function(city)
	{
		return city.main.humidity;
	}))
	timestamp=inData.list.find(function(o){ return o.main.humidity == cityHistory.humidityMin.value; }).dt;
	cityHistory.humidityMin.timestamp=new Date(timestamp*1000).toLocaleDateString();
	
	//WindSpeed Max
	cityHistory.windSpeedMax.value=Math.max.apply(Math,inData.list.map(function(city)
	{
		return city.wind.speed;
	}))
	timestamp=inData.list.find(function(o){ return o.wind.speed == cityHistory.windSpeedMax.value; }).dt;
	cityHistory.windSpeedMax.timestamp=new Date(timestamp*1000).toLocaleDateString();
	
	//WindSpeed Min
	cityHistory.windSpeedMin.value=Math.min.apply(Math,inData.list.map(function(city)
	{
		return city.wind.speed;
	}))
	timestamp=inData.list.find(function(o){ return o.wind.speed == cityHistory.windSpeedMin.value; }).dt;
	cityHistory.windSpeedMin.timestamp=new Date(timestamp*1000).toLocaleDateString();
	
	return cityHistory;

}