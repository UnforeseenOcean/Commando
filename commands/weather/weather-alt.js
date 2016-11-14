// Credit goes to https://github.com/kurisubrooks/midori

const { Command } = require('discord.js-commando');
const moment = require('moment');
const request = require('request-promise');
const winston = require('winston');

const config = require('../../settings');
const version = require('../../package').version;

module.exports = class WeatherCommand extends Command {
	constructor(client) {
		super(client, {
			name: 'weather-alt',
			aliases: ['w-alt'],
			group: 'weather',
			memberName: 'weather-alt',
			description: 'Get the weather.',
			format: '<location>',
			guildOnly: true,

			args: [
				{
					key: 'location',
					prompt: 'What location would you like to have information on?\n',
					type: 'string'
				}
			]
		});
	}

	async run(msg, args) {
		const location = args.location;

		if (!config.GoogleAPIKey) return msg.reply('my Commander has not set the Google API Key. Go yell at him.');
		if (!config.WeatherAPIKey) return msg.reply('my Commander has not set the Weather API Key. Go yell at him.');

		let locationURI = encodeURIComponent(location.replace(/ /g, '+'));

		return request({
			uri: `https://maps.googleapis.com/maps/api/geocode/json?address=${locationURI}&key=${config.GoogleAPIKey}`,
			headers: { 'User-Agent': `Hamakaze ${version} (https://github.com/iCrawl/Hamakaze/)` },
			json: true
		}).then(response => {
			if (response.status !== 'OK') return this.handleNotOK(msg, response.body.status);
			if (response.results.length === 0) return msg.reply('I couldn\'t find a place with the location you provded me');

			return request({
				uri: `https://api.darksky.net/forecast/${config.WeatherAPIKey}/${response.results[0].geometry.location.lat},${response.results[0].geometry.location.lng}?exclude=minutely,hourly,flags&units=auto`,
				headers: { 'User-Agent': `Hamakaze ${version} (https://github.com/iCrawl/Hamakaze/)` },
				json: true
			}).then(res => {
				let datetime = moment().utcOffset(res.timezone).format('D MMMM, h:mma');
				let condition = res.currently.summary;
				let icon = res.currently.icon;
				let chanceofrain = Math.round((res.currently.precipProbability * 100) / 5) * 5;
				let temperature = Math.round(res.currently.temperature * 10) / 10;
				let temperatureMin = Math.round(res.daily.data[0].temperatureMin * 10) / 10;
				let temperatureMax = Math.round(res.daily.data[0].temperatureMax * 10) / 10;
				let feelslike = Math.round(res.currently.apparentTemperature * 10) / 10;
				let humidity = Math.round(res.currently.humidity * 100);
				let windspeed = res.currently.windSpeed;
				let windBearing = res.currently.windBearing;

				let embed = {
					color: 3447003,
					fields: [
						{
							name: 'Los Angeles',
							value: `${this.getBase(icon)}`,
							inline: false
						},
						{
							name: `${condition}`,
							value: `${condition}`,
							inline: true
						},
						{
							name: 'Temperature',
							value: `${temperature}`,
							inline: true
						},
						{
							name: 'High / Low',
							value: `${temperatureMax}\n${temperatureMin}`,
							inline: true
						},
						{
							name: 'Feels like',
							value: `${feelslike}`,
							inline: true
						},
						{
							name: 'Humidity',
							value: `${humidity}`,
							inline: true
						},
						{
							name: 'Chance of rain',
							value: `${chanceofrain}`,
							inline: true
						},
						{
							name: 'Windspeed',
							value: `${windspeed}`,
							inline: true
						},
						{
							name: 'Wind bearing',
							value: `${windBearing}`,
							inline: true
						}
					],
					footer: {
						icon_url: msg.client.user.avatarURL, // eslint-disable-line camelcase
						text: `${datetime}`
					}
				};

				return msg.channel.sendMessage('', { embed })
					.catch(error => { winston.error(error); });
			}).catch(error => {
				return winston.error(error);
			});
		}).catch(error => {
			winston.error(error);
			return msg.say(`Error: Status code ${error.status || error.response} from Google.`);
		});
	}

	handleNotOK(msg, status) {
		if (status === 'ZERO_RESULTS') {
			return { plain: `${msg.author}, your request returned no results.` };
		} else if (status === 'REQUEST_DENIED') {
			return { plain: `Error: Geocode API Request was denied.` };
		} else if (status === 'INVALID_REQUEST') {
			return { plain: `Error: Invalid Request,` };
		} else if (status === 'OVER_QUERY_LIMIT') {
			return { plain: `${msg.author}, Query Limit Exceeded. Try again tomorrow.` };
		} else {
			return { plain: `Error: Unknown.` };
		}
	}

	getBase(icon) {
		if (icon === 'clear-night' || icon === 'partly-cloudly-night') return `☁`;
		if (icon === 'rain') return `🌧`;
		if (icon === 'snow' || icon === 'sleet' || icon === 'fog' || icon === 'wind') return `🌫`;
		if (icon === 'cloudy') return `☁`;
		return `☀`;
	}

	getUnit(units) {
		let unit = units.find(un => un.types.includes('country'));

		if (unit === undefined) return 'm/s';
		if (unit.short_name === 'US' || unit.short_name === 'GB') return 'mph';
		if (unit.short_name === 'CA') return 'kph';
		return 'm/s';
	}
};
