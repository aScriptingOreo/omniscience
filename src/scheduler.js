const { REST, Routes } = require('discord.js');
const { DateTime } = require('luxon');
const path = require('path');
const fs = require('fs');

class Scheduler {
    constructor(client) {
        this.client = client;
        this.rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        this.tasks = new Map();
        this.intervals = {
            commandRefresh: 1,
            voiceCheck: 2
        };
    }

    async start() {
        console.log('Starting scheduler...');
        this.scheduleTask('commandRefresh', this.refreshCommands.bind(this));
        this.scheduleTask('voiceCheck', this.checkVoiceConnections.bind(this));
    }

    scheduleTask(taskName, taskFunction) {
        const taskInfo = {
            name: taskName,
            lastRun: DateTime.now(),
            interval: this.intervals[taskName],
            function: taskFunction
        };

        this.tasks.set(taskName, taskInfo);
        this.scheduleNextRun(taskInfo);
        console.log(`Scheduled task: ${taskName} with ${taskInfo.interval} minute interval`);
    }

    scheduleNextRun(taskInfo) {
        const now = DateTime.now();
        const nextRun = taskInfo.lastRun.plus({ minutes: taskInfo.interval });
        
        if (now >= nextRun) {
            this.executeTask(taskInfo);
        } else {
            const delay = nextRun.diff(now).milliseconds;
            setTimeout(() => this.executeTask(taskInfo), delay);
        }
    }

    async executeTask(taskInfo) {
        try {
            await taskInfo.function();
        } catch (error) {
            console.error(`Error executing task ${taskInfo.name}:`, error);
        }

        taskInfo.lastRun = DateTime.now();
        this.scheduleNextRun(taskInfo);
    }

    async refreshCommands() {
        try {
            const commands = [];
            const commandsPath = path.join(__dirname, 'commands');
            const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

            for (const file of commandFiles) {
                delete require.cache[require.resolve(path.join(commandsPath, file))];
                const command = require(path.join(commandsPath, file));
                commands.push(command.data.toJSON());
            }

            await this.rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands }
            );
        } catch (error) {
            console.error('Error in refreshCommands:', error);
        }
    }

    async checkVoiceConnections() {
        try {
            await require('./utils/voiceUtils').reconnectAllVoiceChannels(this.client);
        } catch (error) {
            console.error('Error checking voice connections:', error);
        }
    }
}

module.exports = Scheduler;
