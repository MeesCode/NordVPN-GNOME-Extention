const Lang = imports.lang;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;

const API_URL = 'https://nordvpn.com/wp-admin/admin-ajax.php';

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
        this._timeout = Mainloop.timeout_add_seconds(10, Lang.bind(this, this._refresh));
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

        let status = this._parseOutput(GLib.spawn_command_line_sync('nordvpn status')[1].toString());
        this.menu.removeAll();

        if (status['Your new IP']) {
            // icon
            this.icon.style_class = 'nordvpn system-status-icon connected';

            // ip
            this.ipItem = new PopupMenu.PopupMenuItem(status['Your new IP'], {});
            this.menu.addMenuItem(this.ipItem);

            // server
            this.serverItem = new PopupMenu.PopupMenuItem(status['Current server'], {});
            this.menu.addMenuItem(this.serverItem);

            // location
            this.locationItem = new PopupMenu.PopupMenuItem(status['Country'] + ', ' + status['City'], {});
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
            if (value) {
                Main.Util.trySpawnCommandLine('nordvpn c');
                this.connectItem.setStatus('refreshing...');
            } else {
                Main.Util.trySpawnCommandLine('nordvpn d');
                this.connectItem.setStatus('refreshing...');
            }
        }));

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