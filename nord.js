const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Main = imports.ui.main;
const Soup = imports.gi.Soup;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const PanelMenu = imports.ui.panelMenu;

const API_URL = 'https://nordvpn.com/wp-admin/admin-ajax.php';

let _httpSession;
let connected = false;

function log(msg) {
    global.log('[NordVPN] ' + msg);
}

const NordVPN = new Lang.Class({
    Name: 'NordVPN status',
    Extends: PanelMenu.Button,
    serverLookUpTable: undefined,

    _init: function () {
        this.parent(0.0, 'NordVPN Status', false);
        this.buttonText = new St.Label({
            text: _('getting status...'),
            y_align: Clutter.ActorAlign.CENTER
        });
        this.buttonText.style_class = 'nordvpn unsure';
        this.actor.add_actor(this.buttonText);
        this._refresh();
    },

    _refresh: function () {
        log('Refreshing');
        this._getStatus();
        this._removeTimeout();
        this._timeout = Mainloop.timeout_add_seconds(30, Lang.bind(this, this._refresh));
        return true;
    },

    _getStatus: function () {
        _httpSession = new Soup.Session();

        let params = {
            action: 'get_user_info_data'
        };

        let message = Soup.form_request_new_from_hash('GET', API_URL, params);
        _httpSession.queue_message(message, Lang.bind(this,
            function (_httpSession, message) {
                if (message.status_code !== 200) {
                    log('http request failed; status:' + message.status_code);
                    this.buttonText.style_class = 'nordvpn unsure';
                    this.buttonText.set_text('no internet access');
                    return;
                }
                let json = JSON.parse(message.response_body.data);
                if (json.status) {
                    connected = true;
                    this.buttonText.style_class = 'nordvpn protected';
                    this.buttonText.set_text(json.ip);
                } else {
                    connected = false;
                    this.buttonText.style_class = 'nordvpn unprotected';
                    this.buttonText.set_text('not connected');
                }

            })
        );
    },

    _removeTimeout: function () {
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = null;
        }
    },

    stop: function () {
        if (_httpSession !== undefined)
            _httpSession.abort();
        _httpSession = undefined;

        if (this._timeout)
            Mainloop.source_remove(this._timeout);
        this._timeout = undefined;

        this.menu.removeAll();
    }
});

let widget;

function init() { }

function enable() {
    widget = new NordVPN;
    Main.panel.addToStatusArea('NordVPN status', widget);
}

function disable() {
    widget.stop();
    widget.destroy();
}
