//modules necessary for successful server implementation
var request = require("request");
var express = require('express');
var json = require('express-json');
var bodyParser = require('body-parser');

var openWeatherAPIKey='81db59a4ba6534eae7b979c59a2356aa';
var currentWeatherURL='http://api.openweathermap.org/data/2.5/weather?';
var authURL='&units=metric&appid='+openWeatherAPIKey;
var lat='lat=';
var lon='&lon=';

function getWeatherPage(req,res)
{
	res.render('cityInfo.html');
}

function getCity(req,res)
{
	var currentUrl = currentWeatherURL+lat+req.params.lat+lon+req.params.lon+authURL;
	request(currentUrl, function(error, response, body)
	{
		var currentCity={};
		var temp=JSON.parse(body);
		currentCity.id=temp.id;
		currentCity.name=temp.name;
		currentCity.country=temp.sys.country;
		currentCity.coord=temp.coord;
		
		res.json(currentCity);
	});
}

var app = express();
app.use(express.static('views'));
app.use(express.static('scripts'));
app.use(express.static('icons'));
app.use(json());
app.use(express.query());
app.use(bodyParser.text()); 
app.engine('html', require('ejs').renderFile);

app.get('/:coordinates', getWeatherPage);
app.get('/city/:lon/:lat',getCity);

require('./currentWeather.js')(app);
require('./forecastWeather.js')(app);
require('./historicalWeather.js')(app);
require('./userPreferences.js')(app);

app.listen(8080,function()
{
	console.log("Application Server started on PORT 8080");
});