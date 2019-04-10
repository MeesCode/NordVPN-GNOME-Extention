const Lang = imports.lang;

const St = imports.gi.St;
const GObject = imports.gi.GObject;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Clutter    = imports.gi.Clutter;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const Mainloop = imports.mainloop;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Data = Me.imports.data;
const countries = Data.countries;
const themes = Data.themes;
const Prefs = Me.imports.prefs;
const inactive_params = Data.inactive_params;
const inactive_list_params = Data.inactive_list_params;

let REFRESH_INTERVAL = 60;
let DEFAULT_COUNTRY = 49;
let CURRENT_COUNTRY = 49;
let SHOW_IP = false;
let SHOW_COUNTRY = false;
let ICON_THEME = 0;

const NordVPN = new Lang.Class({
	Name: 'NordVPN status',
	Extends: PanelMenu.Button,

	// function to set custom icons from the 'icons' directory
	_getCustIcon: function(icon_name) {
		let gicon = Gio.icon_new_for_string(`${Me.dir.get_child('icons').get_path()}/${themes[ICON_THEME]}/${icon_name}.svg`);
		return gicon;
	},

	_init: function () {
		this.parent(0.0, 'NordVPN status');

		let box = new St.BoxLayout({ 
			style_class: 'panel-status-menu-box' 
		});
		this.icon = new St.Icon({
			gicon: this._getCustIcon('nordvpn-changing-symbolic'),
			style_class: 'system-status-icon'
		});
		this._buttonText = new St.Label({
            text: _('text will be here'),
            y_align: Clutter.ActorAlign.CENTER
		});
		box.add_child(this.icon);
		box.add_child(this._buttonText);
		this.actor.add_child(box);

		this._loadSettings();

		this.open = false;
		this.menu.connect('open-state-changed', Lang.bind(this, (self, open) => {
			this.open = open;
		}));

	},

	// refresh the refresh timer and update the connection status
	_refresh: function () {
		this._updateMenu();
		this._removeTimeout();
		this._timeout = Mainloop.timeout_add_seconds(REFRESH_INTERVAL, Lang.bind(this, this._refresh));
		return true;
	},

	// remove the refresh timer
	_removeTimeout: function () {
		if (this._timeout) {
			Mainloop.source_remove(this._timeout);
			this._timeout = null;
		}
	},

	// get the connection status
	_updateMenu: function () {
		// get the nordvpn status
		let CMD = ['nordvpn', 'status'];
		this._execCommand(CMD).then(stdout => {
			let status = {};
			stdout.split('\n').map(item => {
				item = item.split(': ');
				item[0] = item[0].replace('\r-\r  \r', ''); // a dash is send to stdout before showing info, this needs to be removed
				status[item[0]] = item[1];
			});

			status = JSON.parse(JSON.stringify(status)); // ugly, but it cleans up the object real nice
			this._updateTopbar(status);
			this._drawMenu(status);
		});
	},

	// build the popup menu
	_drawMenu: function (status) {
		// if a 'current server' exists nordvpn must be connected
		if (status['Status'] == 'Connected') {
			this.menu.removeAll();
			this.icon.set_gicon(this._getCustIcon('nordvpn-connected-symbolic'));
			this._connectedMenu(status);
		} else if (!this.open) {
			// only update the menu if it is not open (this is to avoid closing the country list while it is open)
			this.menu.removeAll();
			this.icon.set_gicon(this._getCustIcon('nordvpn-disconnected-symbolic'));
			this._disconnectedMenu();
		}
	},

	// menu for when nordvpn is connected
	_connectedMenu: function (status) {
		// stats
		Object.keys(status).map((key, index) => {
			this.menu.addMenuItem(new PopupMenu.PopupMenuItem(`${key}: ${status[key]}`, inactive_params));
		});
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		// connection switch
		this.disconnectItem = new PopupMenu.PopupSwitchMenuItem('connection', true);
		this.menu.addMenuItem(this.disconnectItem);

		this.disconnectItem.connect('toggled', Lang.bind(this, (object, value) => {
			this.icon.set_gicon(this._getCustIcon('nordvpn-changing-symbolic'));
			this.disconnectItem.setStatus('closing...');
			this._disconnect();
		}));
	},

	// menu for when nordvpn is not connected
	_disconnectedMenu: function () {
		// country list submenu
		this.menu.addMenuItem(new PopupMenu.PopupMenuItem('connect to: ' + countries[CURRENT_COUNTRY], inactive_params));
		let countryMenu = new PopupMenu.PopupSubMenuMenuItem('available countries');
		for (let i in countries) {
			let countryItem;
			if (i == CURRENT_COUNTRY) {
				countryItem = new PopupMenu.PopupMenuItem(countries[i] + ' (current)', inactive_list_params);
			} else {
				countryItem = new PopupMenu.PopupMenuItem(countries[i]);
			}

			countryMenu.menu.addMenuItem(countryItem);

			countryItem.connect('activate', Lang.bind(this, (object, value) => {
				CURRENT_COUNTRY = i;
				this._refresh();
			}));
		}
		this.menu.addMenuItem(countryMenu);
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		// connection switch
		this.connectItem = new PopupMenu.PopupSwitchMenuItem('connection');
		this.menu.addMenuItem(this.connectItem);

		this.connectItem.connect('toggled', Lang.bind(this, (object, value) => {
			this.icon.set_gicon(this._getCustIcon('nordvpn-changing-symbolic'));
			this.connectItem.setStatus('establishing...');
			this._connect(countries[CURRENT_COUNTRY]);
		}));
	},

	_updateTopbar: function(status){
		
		if((SHOW_IP || SHOW_COUNTRY) && status['Status'] == 'Connected'){
            this._buttonText.visible = true;
        } else {
			this._buttonText.visible = false;
		}

        if(status['Status'] == 'Connected'){
			if(SHOW_IP && SHOW_COUNTRY){
				this._buttonText.set_text(`${status['Country']} ${status['Your new IP']}`);
			}
			if(SHOW_IP && !SHOW_COUNTRY){
				this._buttonText.set_text(`${status['Your new IP']}`);
			}
			if(!SHOW_IP && SHOW_COUNTRY){
				this._buttonText.set_text(`${status['Country']}`);
			}
        } 
    },

	// disconnect nordvpn
	_disconnect: function () {
		let CMD = ['nordvpn', 'd'];
		this._execCommand(CMD).then(() => {
			this._updateMenu();
		});
	},

	// connect to nordvpn
	_connect: function (country) {
		let CMD = ['nordvpn', 'c'];
		CMD.push(country);
		this._execCommand(CMD).then(() => {
			this._updateMenu();
		});
	},

	// gather user settings on startup
	_loadSettings: function () {
		this._settings = Prefs.SettingsSchema;
		this._settingsChangedId = this._settings.connect('changed',
			Lang.bind(this, this._onSettingsChange));

		this._fetchSettings();
	},

	// gather settings from gnome system
	_fetchSettings: function () {
		REFRESH_INTERVAL = this._settings.get_int(Prefs.Fields.REFRESH_INTERVAL);
		ICON_THEME = this._settings.get_int(Prefs.Fields.ICON_THEME);
		DEFAULT_COUNTRY = this._settings.get_int(Prefs.Fields.DEFAULT_COUNTRY);
		SHOW_IP = this._settings.get_boolean(Prefs.Fields.SHOW_IP);
		SHOW_COUNTRY = this._settings.get_boolean(Prefs.Fields.SHOW_COUNTRY);
		CURRENT_COUNTRY = DEFAULT_COUNTRY;
	},

	// reload settings when something has changed
	_onSettingsChange: function () {
		this._fetchSettings();
		this._refresh();
	},

	// execute a command asynchronously
	// all thanks to this article:
	// https://github.com/andyholmes/andyholmes.github.io/blob/master/articles/asynchronous-programming-in-gjs.md
	_execCommand: async function (argv, cancellable=null) {
		let proc = new Gio.Subprocess({
			argv: argv,
			flags: Gio.SubprocessFlags.STDOUT_PIPE
		});

		proc.init(null);

		let stdout = await new Promise((resolve, reject) => {
			proc.communicate_utf8_async(null, cancellable, (proc, res) => {
				let ok, stdout, stderr;
				[ok, stdout, stderr] = proc.communicate_utf8_finish(res);
				resolve(stdout);
			});
		});

		return stdout;
	}

});

let nordvpn;

function enable() {
	nordvpn = new NordVPN();
	nordvpn._refresh();
	Main.panel.addToStatusArea('nordvpn-status', nordvpn);
}

function disable() {
	nordvpn.destroy();
}