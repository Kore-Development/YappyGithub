const express = require('express');
const bodyParser = require('body-parser');
const ChannelConfig = require('./Models/ChannelConfig');
const GithubEventHandler = require('./Github/EventHandler');
const bot = require('./Discord');

const app = express();
const port = process.env.YAPPY_GITHUB_PORT || process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || 8080;
const ip = process.env.YAPPY_GITHUB_IP || process.env.OPENSHIFT_NODEJS_IP || process.env.IP || null;

app.use(bodyParser.json({
  limit: '250kb',
}));

app.post(['/', '/github'], (req, res) => {
  const event = req.headers['x-github-event'];
  const data = req.body;

  if (!event || !data || !data.repository) return res.status(403).send('Invalid data. Plz use GitHub webhooks.');

  const repo = data.repository.full_name;
  const channels = ChannelConfig.FindByRepo(repo);
  Log.verbose(`GitHub | ${repo} - ${event}`);
  res.send(`${repo} : Received ${event}, emitting to ${channels.size} channels...`);

  channels.forEach(conf => {
    let wantsEmbed = !!conf.embed;
    let { channelId, disabledEvents } = conf;
    let channel = bot.channels.get(channelId);
    if (!channel || disabledEvents.includes(event)) return;

    if (wantsEmbed) {
      let embed = GithubEventHandler.use(data, event, 'embed');
      channel.sendMessage('', { embed }).catch(err => {
        if (err.error === 'Forbidden') {
          channel.guild.owner.sendMessage(`Yappy doesn't have permissions to send messages in ${channel}`);
        } else {
          Log.error(err);
        }
      });
    } else {
      let text = GithubEventHandler.use(data, event);
      channel.sendMessage(text);
    }
  });
});

app.listen(port, ip, () => {
  Log.info(`Express | Listening on ${ip || 'localhost'}:${port}`);
});

module.exports = app;