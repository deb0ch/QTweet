// Direct mappings for discord.js methods
import Discord from "discord.js";
import DBL from "dblapi.js";
import log from "./log";
import Backup from "./backup";

// Passwords file
import * as pw from "../pw.json";

let dClient = new Discord.Client();

const reconnectionDelay = new Backup({
  mode: "exponential",
  startValue: 1000,
  maxValue: 60000
});

let dblClient = pw.DBLToken ? new DBL(pw.DBLToken, dClient) : null;

export const getClient = () => {
  return dClient;
};

export const login = async () => {
  if (dblClient) {
    dblClient.on("error", ({ status }) => {
      log(`Error with DBL client: ${status}`);
    });
  }
  try {
    await dClient.login(pw.dToken);
    reconnectionDelay.reset();
  } catch (err) {
    log("Couldn't log into discord:");
    log(err);
    setTimeout(login, reconnectionDelay.value());
    reconnectionDelay.increment();
  }
};

export const user = () => {
  return dClient.user;
};

export const getChannel = id => {
  return dClient.channels.get(id);
};

export const getGuild = id => {
  return dClient.guilds.get(id);
};

export const getUser = id => {
  return dClient.users.get(id);
};

export const getUserDm = async id => {
  const usr = dClient.users.get(id);
  if (!usr) return null;
  return usr.dmChannel ? usr.dmChannel : usr.createDM();
};

export const canPostIn = channel => {
  if (!channel) return false;
  const permissions = channel.permissionsFor(dClient.user);
  return (
    permissions.has(Discord.Permissions.FLAGS.SEND_MESSAGES) &&
    permissions.has(Discord.Permissions.FLAGS.VIEW_CHANNEL)
  );
};

export const canPostEmbedIn = channel => {
  if (!channel) return false;
  const permissions = channel.permissionsFor(dClient.user);
  return (
    permissions.has(Discord.Permissions.FLAGS.SEND_MESSAGES) &&
    permissions.has(Discord.Permissions.FLAGS.VIEW_CHANNEL) &&
    permissions.has(Discord.Permissions.FLAGS.EMBED_LINKS) &&
    permissions.has(Discord.Permissions.FLAGS.ATTACH_FILES)
  );
};
