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

let defaultCountry = 'Netherlands';

const NordVPN = new Lang.Class({
	Name: 'NordVPN status',
	Extends: PanelMenu.Button,

	// function to set custom icons from the 'icons' directory
	_getCustIcon: function(icon_name) {
		let gicon = Gio.icon_new_for_string(Me.dir.get_child('icons').get_path() + '/' + icon_name + '.svg');
		return gicon;
	},

	_init: function () {
		this.parent(0.0, 'NordVPN status');

		this.icon = new St.Icon({
			gicon: this._getCustIcon('nordvpn-changing-symbolic'),
			style_class: 'system-status-icon'
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

		this.inactive_list_params = {
			reactive: false,
			activate: true,
			hover: true,
			style_class: null,
			can_focus: true
		};

		this.countries = ['Albania', 'Greece', 'Portugal', 'Argentina', 'Hong_Kong', 'Romania', 'Australia', 'Hungary', 'Serbia', 'Austria', 'Iceland', 'Singapore', 'Belgium', 'India', 'Slovakia', 'Bosnia_And_Herzegovina', 'Indonesia', 'Slovenia', 'Brazil', 'Ireland', 'South_Africa', 'Bulgaria', 'Israel', 'South_Korea', 'Canada', 'Italy', 'Spain', 'Chile', 'Japan', 'Sweden', 'Costa_Rica', 'Latvia', 'Switzerland', 'Croatia', 'Luxembourg', 'Taiwan', 'Cyprus', 'Malaysia', 'Thailand', 'Czech_Republic', 'Mexico', 'Turkey', 'Denmark', 'Moldova', 'Ukraine', 'Estonia', 'Netherlands', 'United_Kingdom', 'Finland', 'New_Zealand', 'United_States', 'France', 'North_Macedonia', 'Vietnam', 'Georgia', 'Norway', 'Germany', 'Poland'];

	},

	// refresh the refresh timer and update the connection status
	_refresh: function () {
		this._updateMenu();
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
			this._drawMenu(status);
		});
	},

	// what happens after you've clicked the icon to build the menu
	_drawMenu: function (status) {
		this.menu.removeAll();

		// if a 'current server' exists nordvpn must be connected
		if (status['Status'] == 'Connected') {
			this.icon.set_gicon(this._getCustIcon('nordvpn-connected-symbolic'));
			this._connectedMenu(status);
		} else {
			this.icon.set_gicon(this._getCustIcon('nordvpn-disconnected-symbolic'));
			this._disconnectedMenu();
		}
	},

	// menu for when nordvpn is connected
	_connectedMenu: function (status) {
		// stats
		Object.keys(status).map((key, index) => {
			this.menu.addMenuItem(new PopupMenu.PopupMenuItem(`${key}: ${status[key]}`, this.inactive_params));
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
		this.menu.addMenuItem(new PopupMenu.PopupMenuItem('connect to: ' + defaultCountry, this.inactive_params));
		let countryMenu = new PopupMenu.PopupSubMenuMenuItem('available countries');
		for (let i of this.countries) {
			let countryItem;
			if (i == defaultCountry) {
				countryItem = new PopupMenu.PopupMenuItem(i + ' (current)', this.inactive_list_params);
			} else {
				countryItem = new PopupMenu.PopupMenuItem(i);
			}

			countryMenu.menu.addMenuItem(countryItem);

			countryItem.connect('activate', Lang.bind(this, (object, value) => {
				defaultCountry = i;
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
			this._connect(defaultCountry);
		}));
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
	Main.panel.addToStatusArea('nordvpn-status', nordvpn);
}

function disable() {
	nordvpn.destroy();
}