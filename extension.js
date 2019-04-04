const Lang = imports.lang;

const St = imports.gi.St;
const GObject = imports.gi.GObject;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const Mainloop = imports.mainloop;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const TerminalReader = Me.imports.terminalReader;

const NordVPN = new Lang.Class({
    Name: "NordVPN status",
    Extends: PanelMenu.Button,

    _getCustIcon: function(icon_name) {
		let gicon = Gio.icon_new_for_string( Me.dir.get_child('icons').get_path() + "/" + icon_name + ".svg" );
		return gicon;
    },

    _init: function () {
        this.parent(0.0, "NordVPN status");

        this.icon = new St.Icon({
            gicon: this._getCustIcon('nordvpn-changing-symbolic'),
            style_class: "system-status-icon"
        });

        let box = new St.BoxLayout({ 
            vertical: false, 
            style_class: 'panel-status-menu-box' 
        });

		box.add_child(this.icon);
		this.actor.add_child(box);

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
            this.icon.set_gicon(this._getCustIcon('nordvpn-connected-symbolic'));
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem(status['Your new IP'], this.inactive_params));
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem(status['Current server'], this.inactive_params));
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem(status['Country'] + ', ' + status['City'], this.inactive_params));
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // connection switch
            this.disconnectItem = new PopupMenu.PopupSwitchMenuItem('connection', true);
            this.menu.addMenuItem(this.disconnectItem);

            this.disconnectItem.connect('toggled', Lang.bind(this, function (object, value) {
                this.icon.set_gicon(this._getCustIcon('nordvpn-changing-symbolic'));
                this.disconnectItem.setStatus('closing...');
                this._disconnect();
            }));
            
        } else {
            this.icon.set_gicon(this._getCustIcon('nordvpn-disconnected-symbolic'));

            // connection switch
            this.connectItemNL = new PopupMenu.PopupSwitchMenuItem('connect (NL)', false);
            this.menu.addMenuItem(this.connectItemNL);
            this.connectItemUS = new PopupMenu.PopupSwitchMenuItem('connect (US)', false);
            this.menu.addMenuItem(this.connectItemUS);

            this.connectItemNL.connect('toggled', Lang.bind(this, function (object, value) {
                this.icon.set_gicon(this._getCustIcon('nordvpn-changing-symbolic'));
                this.connectItemNL.setStatus('establishing...');
                this.connectItemUS.setStatus('ignoring...');
                this._connect('netherlands');
            }));
    
            this.connectItemUS.connect('toggled', Lang.bind(this, function (object, value) {
                this.icon.set_gicon(this._getCustIcon('nordvpn-changing-symbolic'));
                this.connectItemUS.setStatus('establishing...');
                this.connectItemNL.setStatus('ignoring...');
                this._connect('united_states');
            }));
        }

    },

    _disconnect: function () {
        new TerminalReader.TerminalReader('nordvpn d > /dev/null ; echo disconnected', (cmd, success, result) => {
            this._getStatus();
        }).executeReader();
    },

    _connect: function (country) {
        new TerminalReader.TerminalReader('nordvpn c '+ country +' > /dev/null ; echo connected', (cmd, success, result) => {
            this._getStatus();
        }).executeReader();
    }

});

let nordvpn;

function enable() {
    nordvpn = new NordVPN();
    nordvpn._refresh();
    Main.panel.addToStatusArea("nordvpn-status", nordvpn);
}

function disable() {
    nordvpn.destroy();
}