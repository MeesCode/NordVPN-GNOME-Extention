const Lang = imports.lang;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Mainloop = imports.mainloop;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const TerminalReader = Me.imports.terminalReader;

const NordVPN = new Lang.Class({
    Name: "NordVPN status",
    Extends: PanelMenu.Button,

    _init: function () {
        this.parent(null, "NordVPN status");

        let hbox = new St.BoxLayout({ 
            style_class: 'panel-status-menu-box' 
        });
        this.icon = new St.Icon({
            icon_name: 'nordvpn-changing',
            style_class: "system-status-icon"
        });
        hbox.add_child(this.icon);
        //hbox.add(PopupMenu.arrowIcon(St.Side.BOTTOM));
        this.actor.add_child(hbox);

        this.inactive_params = {
            reactive: true,
            activate: false,
            hover: false,
            style_class: null,
            can_focus: false
        };

    },

    _refresh: function () {
        this._getStatus();
        this._removeTimeout();
        this._timeout = Mainloop.timeout_add_seconds(60, Lang.bind(this, this._refresh));
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
            this._drawMenu(this._parseOutput(result));
        }).executeReader();
    },

    _drawMenu: function (status) {
        this.menu.removeAll();

        if (status['Your new IP']) {
            this.icon.icon_name = 'nordvpn-connected';
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem(status['Your new IP'], this.inactive_params));
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem(status['Current server'], this.inactive_params));
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem(status['Country'] + ', ' + status['City'], this.inactive_params));
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // connection switch
            this.connectItem = new PopupMenu.PopupSwitchMenuItem('connection', true);
            this.menu.addMenuItem(this.connectItem);
        } else {
            this.icon.icon_name = 'nordvpn-disconnected';

            // connection switch
            this.connectItem = new PopupMenu.PopupSwitchMenuItem('connection', false);
            this.menu.addMenuItem(this.connectItem);
        }

        this.connectItem.connect('toggled', Lang.bind(this, function (object, value) {
            this.icon.icon_name = 'nordvpn-changing';
            if (value) {
                this.connectItem.setStatus('establishing...');
                this._connect();
            } else {
                this.connectItem.setStatus('closing...');
                this._disconnect();
            }
        }));
    },

    _disconnect: function () {
        let tr = new TerminalReader.TerminalReader('nordvpn d > /dev/null ; echo disconnected', (cmd, success, result) => {
            this._getStatus();
        }).executeReader();
    },

    _connect: function () {
        let tr = new TerminalReader.TerminalReader('nordvpn c > /dev/null ; echo connected', (cmd, success, result) => {
            this._getStatus();
        }).executeReader();
    }

});

function init(metadata) {
    let theme = imports.gi.Gtk.IconTheme.get_default();
    theme.append_search_path(metadata.path + "/icons");
}

function enable() {
    let nordvpn = new NordVPN();
    nordvpn._refresh();
    Main.panel.addToStatusArea("nordvpn-status", nordvpn);
}

function disable() {
    Main.panel.statusArea["nordvpn-status"].destroy();
}