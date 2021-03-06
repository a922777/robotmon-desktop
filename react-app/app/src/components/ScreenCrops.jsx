import React, { Component } from 'react';
import PropTypes from 'prop-types';
import _ from 'lodash';
import fp from 'func-pipe';

import { CLogsEB, CScreenCropsEB } from '../modules/event-bus';
import CropImage from './CropImage';

export default class ScreenCrops extends Component {
  constructor(props) {
    super(props);
    this.props = props;
    this.state = {
      deviceImages: {},
    };

    this.refresh = this.refresh.bind(this);
    this.pullImageBase64 = this.pullImageBase64.bind(this);
    this.newImage = this.newImage.bind(this);
    this.appName = '';
    this.imagePath = '';
    this.editorClient = undefined;
  }

  static get defaultProps() {
    return {
      editorClient: undefined,
    };
  }

  static get propTypes() {
    return {
      editorClient: PropTypes.object,
      display: PropTypes.bool.isRequired,
    };
  }

  componentDidMount() {
    CScreenCropsEB.addListener(CScreenCropsEB.EventAppNameChanged, (appName) => {
      if (this.appName !== appName) {
        this.appName = appName;
        this.refresh();
      }
    });

    CScreenCropsEB.addListener(CScreenCropsEB.EventNewImageCropped, (filename) => {
      this.newImage(filename);
    });
  }

  componentWillReceiveProps(nextProps) {
    this.editorClient = nextProps.editorClient;
  }

  pullImageBase64(filePath) {
    CLogsEB.emit(CLogsEB.EventNewLog, CLogsEB.TagDesktop, CLogsEB.LevelInfo, `Pull Image ${filePath}`);
    const scripts = `
      var _desktop_open_img = openImage("${filePath}");
      var _desktop_img_base64 = '';
      if (_desktop_open_img != 0) {
        _desktop_img_base64 = getBase64FromImage(_desktop_open_img);
        releaseImage(_desktop_open_img);
      }
      _desktop_img_base64;
    `;
    return fp
      .pipe(fp.bind(this.editorClient.client.runScript, scripts))
      .pipe(result => result.message)
      .promise();
  }

  newImage(filename) {
    const filePath = `${this.imagePath}/${filename}`;
    return fp
      .pipe(fp.bind(this.pullImageBase64, filePath))
      .pipe((base64) => {
        this.state.deviceImages[filePath] = `data:image/png;base64,${base64}`;
        this.setState({
          deviceImages: this.state.deviceImages,
        });
      })
      .promise();
  }

  refresh() {
    if (_.isUndefined(this.editorClient)) {
      return;
    }
    CLogsEB.emit(CLogsEB.EventNewLog, CLogsEB.TagDesktop, CLogsEB.LevelInfo, 'Refresh Images...');
    this.setState({
      deviceImages: {},
    });
    setTimeout(() => {
      if (!this.editorClient.isConnect) {
        CLogsEB.emit(CLogsEB.EventNewLog, CLogsEB.TagDesktop, CLogsEB.LevelWarning, `Device not connected ${this.editorClient.ip}`);
        return;
      }
      this.imagePath = `${this.editorClient.storagePath}/scripts/${this.appName}/images`;
      const fpPromise = fp.pipe(fp.bind(this.editorClient.client.runScript, `execute('ls ${this.imagePath}');`));
      fpPromise.pipe(({ message }) => {
        const filenames = _.filter(message.split('\n'), v => v !== '');
        _.forEach(filenames, (filename) => {
          fpPromise.pipe(fp.bind(this.newImage, filename));
        });
      });
    }, 200);
  }

  render() {
    let className = 'panel-container display-none';
    if (this.props.display) {
      className = 'panel-container display-block';
    }
    return (
      <div className={className}>
        <div className="panel-header">
          Screen Crop
        </div>
        {_.map(this.state.deviceImages, (base64, key) => <CropImage key={key} src={base64} filepath={key} />)}
      </div>
    );
  }
}
