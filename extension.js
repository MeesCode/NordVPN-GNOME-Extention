const Lang = imports.lang;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const TerminalReader = Me.imports.terminalReader;


const NordVPN = new Lang.Class({
    Name: "NordVPN status",
    Extends: PanelMenu.Button,

    _init: function () {
        this.parent(null, "NordVPN status");

        // Icon
        this.icon = new St.Icon({
            style_class: "nordvpn system-status-icon disconnected"
        });
        this.actor.add_actor(this.icon);

    },

    _refresh: function () {
        this._getStatus();
        this._removeTimeout();
        this._timeout = Mainloop.timeout_add_seconds(30, Lang.bind(this, this._refresh));
        return true;
    },

    _removeTimeout: function () {
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = null;
        }
    },

    _parseOutput: function (raw) {
        let status = {};
        let result = raw.split("\n");
        result.forEach(function (line, idx) {
            line = line.split(': ');
            status[line[0]] = line[1];
        });
        return status;
    },

    _getStatus: function () {

        let tr = new TerminalReader.TerminalReader('nordvpn status', (cmd, success, result) => {
            let status = this._parseOutput(result);

            let inactive_params = {
                reactive: true,
                activate: true,
                hover: false,
                style_class: null,
                can_focus: false
            };

            this.menu.removeAll();

            if (status['Your new IP']) {
                // icon
                this.icon.style_class = 'nordvpn system-status-icon connected';

                // ip
                this.ipItem = new PopupMenu.PopupMenuItem(status['Your new IP'], inactive_params);
                this.menu.addMenuItem(this.ipItem);

                // server
                this.serverItem = new PopupMenu.PopupMenuItem(status['Current server'], inactive_params);
                this.menu.addMenuItem(this.serverItem);

                // location
                this.locationItem = new PopupMenu.PopupMenuItem(status['Country'] + ', ' + status['City'], inactive_params);
                this.menu.addMenuItem(this.locationItem);

                // spacer
                this.spacerItem = new PopupMenu.PopupSeparatorMenuItem();
                this.menu.addMenuItem(this.spacerItem);

                // connection switch
                this.connectItem = new PopupMenu.PopupSwitchMenuItem('connection', true);
                this.menu.addMenuItem(this.connectItem);
            } else {
                //icon
                this.icon.style_class = 'nordvpn system-status-icon disconnected';

                // connection switch
                this.connectItem = new PopupMenu.PopupSwitchMenuItem('connection', false);
                this.menu.addMenuItem(this.connectItem);
            }

            this.connectItem.connect('toggled', Lang.bind(this, function (object, value) {
                this.icon.style_class = 'nordvpn system-status-icon changing';
                if (value) {
                    this.connectItem.setStatus('establishing...');
                    this._connect();
                } else {
                    this.connectItem.setStatus('closing...');
                    this._disconnect();
                }
            }));

        });

        tr.executeReader();

    },

    _disconnect: function () {
        let tr = new TerminalReader.TerminalReader('nordvpn d > /dev/null ; echo disconnected', (cmd, success, result) => {
            this._getStatus();
        });
        tr.executeReader();
    },

    _connect: function () {
        let tr = new TerminalReader.TerminalReader('nordvpn c > /dev/null ; echo connected', (cmd, success, result) => {
            this._getStatus();
        });
        tr.executeReader();
    }

});

function init() {
}

function enable() {
    let indicator = new NordVPN();
    indicator._refresh();
    Main.panel.addToStatusArea("nordvpn-status", indicator);
}

function disable() {
    // you could also track "indicator" and just call indicator.destroy()
    Main.panel.statusArea["nordvpn-status"].destroy();
}