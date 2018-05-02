import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Collapsible from 'react-collapsible';
import { Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import { defaultCollDesc } from 'config';

import Modal from 'components/Modal';
import SidebarHeader from 'components/SidebarHeader';
import Truncate from 'components/Truncate';
import WYSIWYG from 'components/WYSIWYG';
import { AllPagesIcon, CheckIcon, PlusIcon, WarcIcon, XIcon } from 'components/icons';

import ListItem from './ListItem';
import EditItem from './EditItem';

import './style.scss';


class ListsUI extends Component {

  static contextTypes = {
    asPublic: PropTypes.bool,
    canAdmin: PropTypes.bool,
    isAnon: PropTypes.bool
  };

  static propTypes = {
    activeListId: PropTypes.string,
    addToList: PropTypes.func,
    collection: PropTypes.object,
    collapsibleToggle: PropTypes.func,
    createList: PropTypes.func,
    deleteList: PropTypes.func,
    editColl: PropTypes.func,
    editList: PropTypes.func,
    loaded: PropTypes.bool,
    loading: PropTypes.bool,
    lists: PropTypes.object,
    list: PropTypes.object,
    publicIndex: PropTypes.bool,
    sortLists: PropTypes.func
  };

  constructor(props, { asPublic }) {
    super(props);

    const lists = asPublic ? props.lists.filter(l => l.get('public')) : props.lists;
    this.state = {
      editModal: false,
      title: '',
      isCreating: false,
      created: false,
      isEditing: false,
      edited: false,
      lists,
      minimized: false
    };
  }

  componentWillReceiveProps(nextProps) {
    const { isCreating, created, isEditing, edited } = this.state;

    if (isCreating && !created && this.props.lists !== nextProps.lists) {
      this.setState({ title: '', isCreating: false, created: true });
      setTimeout(() => { this.setState({ created: false, isCreating: false }); }, 3000);
    }

    if (isEditing && !edited && this.props.lists !== nextProps.lists) {
      this.setState({ isEditing: false, edited: true });
      setTimeout(() => { this.setState({ edited: false, isEditing: false, editId: null }); }, 5000);
    }

    if (nextProps.lists !== this.props.lists) {
      this.setState({ lists: nextProps.lists });
    }
  }

  handleInput = (evt) => {
    this.setState({
      [evt.target.name]: evt.target.value
    });
  }

  submitCheck = (evt) => {
    if (evt.key === 'Enter') {
      this.createList();
    }
  }

  createList = () => {
    const { collection, createList } = this.props;
    const { title } = this.state;

    if (title) {
      this.setState({ created: false, isCreating: true });
      createList(collection.get('user'), collection.get('id'), title);
    }
  }

  sendDeleteList = (listId) => {
    const { collection } = this.props;
    this.props.deleteList(collection.get('user'), collection.get('id'), listId);
  }

  sendEditList = (listId, data) => {
    const { collection } = this.props;
    this.setState({ edited: false, isEditing: true, editId: listId });
    this.props.editList(collection.get('user'), collection.get('id'), listId, data);
  }

  toggleIndexVisibility = () => {
    const { collection, editColl, publicIndex } = this.props;
    editColl(collection.get('user'), collection.get('id'), { public_index: !publicIndex });
  }

  clearInput = () => this.setState({ title: '' })

  openEditModal = (evt) => {
    evt.stopPropagation();
    this.setState({ editModal: true });
  }

  closeEditModal = () => { this.setState({ editModal: false }); }

  sortLists = (origIndex, hoverIndex) => {
    const { lists } = this.state;
    const o = lists.get(origIndex);
    const sorted = lists.splice(origIndex, 1)
                        .splice(hoverIndex, 0, o);

    this.setState({ lists: sorted });
  }

  saveListSort = () => {
    const { collection } = this.props;
    const order = this.state.lists.map(o => o.get('id')).toArray();
    this.props.sortLists(collection.get('user'), collection.get('id'), order);
  }

  minimize = () => {
    this.setState({ minimized: !this.state.minimized });
  }

  close = () => this.props.collapsibleToggle(false);
  open = () => this.props.collapsibleToggle(true);

  render() {
    const { canAdmin } = this.context;
    const { activeListId, collection, list, publicIndex } = this.props;
    const { created, editModal, edited, editId, isCreating, lists, title } = this.state;

    // wait until collection is loaded
    if (!collection.get('loaded')) {
      return null;
    }

    const header = (
      <SidebarHeader
        label="Collection Navigator"
        callback={this.minimize}
        closed={this.state.minimized} />
    );

    return (
      <React.Fragment>
        <Collapsible
          open
          transitionTime={300}
          easing="ease-in-out"
          classParentString="wr-coll-sidebar"
          trigger={header}
          onOpen={this.open}
          onClose={this.close}>
          <div className="lists-body">
            {
              activeListId &&
                <React.Fragment>
                  <header className="collection-header">
                    <h4><WarcIcon /> PARENT COLLECTION</h4>
                    <h2>{collection.get('title')}</h2>
                  </header>
                  <Truncate height={50}>
                    <WYSIWYG
                      initial={collection.get('desc') || defaultCollDesc}
                      editMode={false} />
                  </Truncate>
                </React.Fragment>
            }
            <header className="lists-header">
              <h4>Lists ({lists.size})</h4>
              {
                canAdmin &&
                  <React.Fragment>
                    <button onClick={this.openEditModal} className="button-link list-edit">EDIT</button>
                    <button onClick={this.openEditModal} className="borderless"><PlusIcon /></button>
                  </React.Fragment>
              }
            </header>
            <ul>
              {
                lists.map((listObj, idx) => (
                  <ListItem
                    addToList={this.props.addToList}
                    collection={collection}
                    editList={this.sendEditList}
                    index={idx}
                    key={listObj.get('id')}
                    list={listObj}
                    selected={list && listObj.get('id') === activeListId}
                    saveSort={this.saveListSort}
                    sort={this.sortLists} />
                ))
              }
              {
                (publicIndex || canAdmin) &&
                  <React.Fragment>
                    <li className="divider" />
                    <li className={classNames('all-pages', { selected: !activeListId })}>
                      <div className="wrapper">
                        <Link to={`/${collection.get('user')}/${collection.get('id')}/pages`} title="See all pages in this collection" className="button-link"><AllPagesIcon /> See all pages in this collection</Link>
                        {
                          canAdmin &&
                            <button
                              aria-label={publicIndex ? 'set page index public' : 'set page index private'}
                              onClick={this.toggleIndexVisibility}
                              className={classNames('visiblity-toggle', { public: publicIndex })}
                              title="Toggle page index visibility" />
                        }
                      </div>
                    </li>
                  </React.Fragment>
              }
            </ul>
          </div>
        </Collapsible>
        {
          /* lists edit modal */
          canAdmin &&
            <Modal
              visible={editModal}
              closeCb={this.closeEditModal}
              footer={<Button onClick={this.closeEditModal} bsStyle="success">Done</Button>}
              dialogClassName="lists-edit-modal">
              <ul>
                <li>
                  <button className="borderless" onClick={this.clearInput} disabled={!title.length}><XIcon /></button>
                  <input name="title" className="borderless-input" onKeyPress={this.submitCheck} onChange={this.handleInput} value={title} placeholder="Create new list" autoFocus />
                  {
                    created ?
                      <button className="borderless"><CheckIcon success /></button> :
                      <button className={classNames('borderless', { 'wr-add-list': title.length })} onClick={this.createList} disabled={!title.length || isCreating}><PlusIcon /></button>
                  }
                </li>
                {
                  lists.map(listObj => (
                    <EditItem
                      key={listObj.get('id')}
                      list={listObj}
                      edited={edited && listObj.get('id') === editId}
                      editListCallback={this.sendEditList}
                      deleteListCallback={this.sendDeleteList} />
                  ))
                }
              </ul>
            </Modal>
        }
      </React.Fragment>
    );
  }
}

export default ListsUI;
