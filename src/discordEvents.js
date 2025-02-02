import Discord from "discord.js";

// A module registering discord events and reacting to them
import { fortune } from "fortune-teller";

// Config file
import * as config from "../config.json";
import { rmChannel, rmGuild, sanityCheck, getLang } from "./subs";
import QChannel from "./QChannel";

// logging
import log from "./log";
import {
  message as postMessage,
  dm,
  embed as postEmbed,
  translated as postTranslatedMessage
} from "./post";
import { createStream, destroyStream } from "./twitter";
import commands from "./commands";
import { user, login } from "./discord";
import i18n from "./i18n";

const handleCommand = (commandName, author, qChannel, args) => {
  const command = commands[commandName];
  // Check that the command exists
  if (command) {
    // Check that there's the right number of args
    if (args.length < command.minArgs) {
      postTranslatedMessage(qChannel, `usage-${commandName}`);
      return;
    }
    log(
      `Executing command: "${commandName} ${args}" from ${author.tag}`,
      qChannel
    );
    let validChecks = 0;
    let isValid = true;
    if (command.checks.length > 0)
      command.checks.forEach(({ f, badB }) => {
        // Check every condition to perform the command
        f(author, qChannel, passed => {
          // It's already marked as invalid
          if (!isValid) return;
          if (passed) validChecks++;
          else {
            isValid = false;
            if (badB) postTranslatedMessage(qChannel, badB); // If it's not met and we were given a bad boy, post it
            log(
              `Rejected command "${commandName} ${args}" with reason: ${badB}`
            );
            return;
          }
          if (validChecks === command.checks.length) {
            // If we get here, everything has succeeded.
            command.function(args, qChannel, author);
          }
        });
      });
    else command.function(args, qChannel, author);
  }
};

export const handleMessage = async message => {
  // Ignore bots
  if (message.author.bot) return;
  const { author, channel } = message;

  if (message.content.indexOf(config.prefix) !== 0) {
    if (
      !!message.mentions &&
      !!message.mentions.members &&
      message.mentions.members.find(item => item.user.id === user().id)
    ) {
      message.reply(fortune());
    } else if (message.channel.type == "dm") {
      const qc = new QChannel(channel);
      const lang = await getLang(qc.guildId());
      postMessage(qc, i18n(lang, "welcomeMessage"));
    }
    return;
  }
  let args = message.content
    .slice(config.prefix.length)
    .trim()
    .split(/ +/g);

  let command = args.shift().toLowerCase();
  const qc = new QChannel(channel);
  const lang = await getLang(qc.guildId());

  if (command === "help" || command === "?") {
    const embed = new Discord.RichEmbed()
      .setColor(0x0e7675)
      .setTitle(i18n(lang, "helpHeader"))
      .setURL(config.profileURL)
      .setDescription(i18n(lang, "helpIntro"))
      .addField(`${config.prefix}tweet`, i18n(lang, "usage-tweet"))
      .addField(`${config.prefix}start`, i18n(lang, "usage-start"))
      .addField(`${config.prefix}stop`, i18n(lang, "usage-stop"))
      .addField(`${config.prefix}list`, i18n(lang, "usage-list"))
      .setFooter(i18n(lang, "helpFooter", { artist: "ryusukehamamoto" }));
    postEmbed(qc, { embed });
    return;
  }

  handleCommand(command, author, qc, args);
};

export const handleError = ({ message, error }) => {
  log(`Discord client encountered an error: ${message}`);
  log(error);
  // Destroy the twitter stream cleanly, we will re-intantiate it sooner that way
  destroyStream();
  login();
};

export const handleGuildCreate = async guild => {
  // Message the guild owner with useful information
  log(`Joined guild ${guild.name}`);
  const qc = QChannel.unserialize({ channelId: guild.ownerID, isDM: true });
  if (qc && qc.id) dm(qc, i18n("en", "welcomeMessage"));
  else {
    log(`Could not send welcome message for ${guild.name}`);
  }
};

export const handleGuildDelete = async ({ id, name }) => {
  log(`Left guild ${name}`);
  const { users } = await rmGuild(id);
  if (users > 0) createStream();
};

export const handleReady = async () => {
  log("Successfully logged in to Discord");
  await sanityCheck();
  createStream();
};

export const handleChannelDelete = async ({ id, name }) => {
  const { subs, users } = await rmChannel(id);
  if (subs > 0) {
    log(`Channel #${name} (${id}) deleted. Removed ${subs} subscriptions.`);
    if (users > 0) createStream();
  }
};
