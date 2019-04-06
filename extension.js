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

const NordVPN = new Lang.Class({
    Name: "NordVPN status",
    Extends: PanelMenu.Button,

    // function to set custom icons from the 'icons' directory
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

    // refresh the refresh timer and update the connection status
    _refresh: function () {
        this._getStatus();
        this._removeTimeout();
        this._timeout = Mainloop.timeout_add_seconds(60, Lang.bind(this, this._refresh));
        return true;
    },

    // remove the refresh timer
    _removeTimeout: function () {
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = null;
        }
    },

    // parse terminal output
    _parseOutput: function (raw) {
        let status = {};
        let result = raw.split("\n");
        result.forEach(function (line, idx) {
            line = line.split(': ');
            status[line[0]] = line[1];
        });
        return status;
    },

    // get the connection status
    _getStatus: function () {
        let CMD = ['nordvpn', 'status']
        this._execCommand(CMD).then(stdout => {
            stdout.split('\n').map(line => log(line));
            this._drawMenu(stdout.split('\n'));
        });
    },

    // what happens after you've clicked the icon to build the menu
    _drawMenu: function (status) {
        this.menu.removeAll();

        if (status.length > 5) {
            // build a menu for when nord vpn is connected
            this.icon.set_gicon(this._getCustIcon('nordvpn-connected-symbolic'));
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem(status[4], this.inactive_params));
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem(status[1], this.inactive_params));
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem(status[2] + ', ' + status[3], this.inactive_params));
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
            //build a menu for when nordvpn is disconnected
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

    // disconnect nordvpn
    _disconnect: function () {
        log("in disconnect function");
        let CMD = ['nordvpn', 'd'];
        this._execCommand(CMD).then(stdout => {
            this._getStatus();
        });
    },

    // connect to nordvpn
    _connect: function (country) {
        log("in connect function");
        let CMD = ['nordvpn', 'c'];
        CMD.push(country);
        this._execCommand(CMD).then(stdout => {
            this._getStatus();
        });
    },

    // execute a command asynchronously
    _execCommand: async function (argv, cancellable=null) {
        let proc = new Gio.Subprocess({
            argv: argv,
            flags: Gio.SubprocessFlags.STDOUT_PIPE
        });

        proc.init(null);

        let stdout = await new Promise((resolve, reject) => {
            proc.communicate_utf8_async(null, cancellable, (proc, res) => {
                let ok, stdout, stderr;

                try {
                    [ok, stdout, stderr] = proc.communicate_utf8_finish(res);
                    resolve(stdout);
                } catch (e) {
                    reject(e);
                }
            });
        });

        return stdout;
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