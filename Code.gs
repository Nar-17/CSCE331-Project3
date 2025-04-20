function chatCompletions(messages) {
  const endpoint = "https://models.github.ai/inference";
  const model = "deepseek/DeepSeek-V3-0324";
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("LYLE_MODEL_TOKEN");
  
  const url = endpoint + '/chat/completions?api-version=2024-05-01-preview';
  const payload = {
    model,
    messages,
    temperature: 0.0,
    top_p:      1.0,
    max_tokens: 1000
  };

  const options = {
    method:            'post',
    contentType:       'application/json',
    muteHttpExceptions: false,
    headers: {
      Authorization: 'Bearer ' + token
    },
    payload: JSON.stringify(payload)
  };

  const resp = UrlFetchApp.fetch(url, options);
  const code = resp.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error(`Inference API error ${code}: ${resp.getContentText()}`);
  }
  const data = JSON.parse(resp.getContentText());
  return data.choices[0].message.content;
}

  /** Example runner in Apps Script */
function runDemo() {
  const res = UrlFetchApp.fetch('https://www.google.com', {muteHttpExceptions: true});
  console.log(res.getResponseCode());

  const messages = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user',   content: 'What is the capital of France?' }
  ];

  const answer = chatCompletions(messages);
  console.log('AI says: %s', answer);
}

/**
 * @OnlyCurrentDoc
 *
 * The above comment directs Apps Script to limit the scope of file
 * access for this add-on. It specifies that this add-on will only
 * attempt to read or modify the files in which the add-on is used,
 * and not all of the user's files. The authorization request message
 * presented to users will reflect this limited scope.
 */

/**
 * Creates a menu entry in the Google Docs UI when the document is opened.
 * This method is only used by the regular add-on, and is never called by
 * the mobile add-on version.
 *
 * @param {object} e The event parameter for a simple onOpen trigger. To
 *     determine which authorization mode (ScriptApp.AuthMode) the trigger is
 *     running in, inspect e.authMode.
 */
function onOpen(e) {
  DocumentApp.getUi().createAddonMenu()
      .addItem('Start', 'showSidebar')
      .addToUi();
}

/**
 * Runs when the add-on is installed.
 * This method is only used by the regular add-on, and is never called by
 * the mobile add-on version.
 *
 * @param {object} e The event parameter for a simple onInstall trigger. To
 *     determine which authorization mode (ScriptApp.AuthMode) the trigger is
 *     running in, inspect e.authMode. (In practice, onInstall triggers always
 *     run in AuthMode.FULL, but onOpen triggers may be AuthMode.LIMITED or
 *     AuthMode.NONE.)
 */
function onInstall(e) {
  onOpen(e);
}

/**
 * Opens a sidebar in the document containing the add-on's user interface.
 * This method is only used by the regular add-on, and is never called by
 * the mobile add-on version.
 */
function showSidebar() {
  const ui = HtmlService.createHtmlOutputFromFile('sidebar')
      .setTitle('Rubric Evaluator');
  DocumentApp.getUi().showSidebar(ui);
}
function getSavedRubrics() {
  var userProps = PropertiesService.getUserProperties();
  var savedRubricsStr = userProps.getProperty("savedRubrics");
  var savedRubrics = savedRubricsStr ? JSON.parse(savedRubricsStr) : {};
  var options = ['<option value="" disabled selected>Select a saved rubric</option>'];

  for (var rubricName in savedRubrics) {
    options.push('<option value="' + rubricName + '">' + rubricName + '</option>');
  }

  return options.join('');
}
function getRubric(rubric_name) {
  var userProps = PropertiesService.getUserProperties();
  var savedRubricsStr = userProps.getProperty("savedRubrics");
  var savedRubrics = savedRubricsStr ? JSON.parse(savedRubricsStr) : {};
  return savedRubrics[rubric_name] || "";
}
/**
 * Saves the provided rubric somewhere
 */
function saveRubric(rubric_name, rubric) {
  if (!rubric_name || !rubric) {
    throw new Error("Both rubric name and rubric text must be provided.");
  }
  
  var userProps = PropertiesService.getUserProperties();
  var savedRubricsStr = userProps.getProperty("savedRubrics");
  var savedRubrics = savedRubricsStr ? JSON.parse(savedRubricsStr) : {};
  
  // Save the rubric content under its name
  savedRubrics[rubric_name] = rubric;
  
  userProps.setProperty("savedRubrics", JSON.stringify(savedRubrics));
  Logger.log("Saved rubrics: " + JSON.stringify(savedRubrics));
  
  msg = "Rubric '" + rubric_name + "' saved successfully!";
  showAlert(msg)
  return msg;
}

function deleteRubric(rubric_name) {
  if (!rubric_name) throw new Error("Rubric name required for deletion.");

  var userProps = PropertiesService.getUserProperties();
  var savedRubricsStr = userProps.getProperty("savedRubrics");
  var savedRubrics = savedRubricsStr ? JSON.parse(savedRubricsStr) : {};

  if (savedRubrics.hasOwnProperty(rubric_name)) {
    delete savedRubrics[rubric_name];
    userProps.setProperty("savedRubrics", JSON.stringify(savedRubrics));
    return "Rubric '" + rubric_name + "' has been deleted.";
  } else {
    throw new Error("Rubric '" + rubric_name + "' not found.");
  }
}

/**
 * Should read in entire document and evaluate it using the selected rubric
 */
function evaluateDocument(rubric) {
  var selectedText;
  try {
    // Retrieve the selected text from the document
    selectedText = getSelectedText();
  } catch(e) {
    return "<p style='color:red;'>Error: " + e.message + "</p>";
  }
  
  const evaluationInput = [
    { role: 'system', content: 'You are a helpful ruberic grading assistant. A user will give you a selection of text and a ruberic, your job is to critically evlauate how well the selection of text adheres to the requests present in the ruberic and provide qualitative feedback in the form of a comment and quantitative feedback in the form of a numerical grade in between 0 and 100. If the ruberic contains subsections, you should also include how many points are satisfied in each subsection.' },
    { role: 'user',   content: 'Please grade the following document according to this rubric' + rubric + " Here is the document to grade" + selectedText.join("\n")}
  ];

  const evaluationResult = chatCompletions(evaluationInput);

  // Log for debugging (view via Apps Script Logger)
  Logger.log("Evaluation Input:\n" + evaluationInput);
                         
  showEvaluationPopup(evaluationResult);

  // Return the evaluation result as HTML.
  return "<p>" + evaluationResult + "</p>";
}

function showEvaluationPopup(evaluation) {
  const template = HtmlService.createTemplateFromFile("evalPopup");
  template.evaluation = evaluation;
  const popup = template.evaluate().setWidth(800).setHeight(600);
	DocumentApp.getUi().showModalDialog(popup, "Evaluation");
}

function showAlert(msg) {
  DocumentApp.getUi().alert(msg);
}

/**
 * takes the provided feedback and appends it to the end of the doc?
 */
function importFeedbackToDoc(feedback) {
  if (!feedback) {
    DocumentApp.getUi().alert('No feedback to import.');
    return;
  }
  
  const body = DocumentApp.getActiveDocument().getBody();
  const paras = body.getParagraphs();
  const lastParaText = paras[paras.length - 1].getText().trim();
  const firstLine = feedback.split('\n')[0].trim();
  
  // If the first line of your feedback is already the last paragraph,
  // assume we’ve imported it.
  if (lastParaText === firstLine) {
    DocumentApp.getUi().alert('Feedback already imported.');
    return;
  }
  
  // Otherwise append it
  body.appendHorizontalRule();
  body.appendParagraph('Imported Feedback:')
      .setHeading(DocumentApp.ParagraphHeading.HEADING2);
  feedback.split('\n').forEach(function(line) {
    body.appendParagraph(line);
  });
  
  DocumentApp.getUi().alert('Feedback imported to document.');
}

/**
 * Gets the text the user has selected. If there is no selection,
 * this function displays an error message.
 *
 * @return {Array.<string>} The selected text.
 */
function getSelectedText() {
  const selection = DocumentApp.getActiveDocument().getSelection();
  const text = [];
  if (selection) {
    const elements = selection.getSelectedElements();
    for (let i = 0; i < elements.length; ++i) {
      if (elements[i].isPartial()) {
        const element = elements[i].getElement().asText();
        const startIndex = elements[i].getStartOffset();
        const endIndex = elements[i].getEndOffsetInclusive();

        text.push(element.getText().substring(startIndex, endIndex + 1));
      } else {
        const element = elements[i].getElement();
        // Only translate elements that can be edited as text; skip images and
        // other non-text elements.
        if (element.editAsText) {
          const elementText = element.asText().getText();
          // This check is necessary to exclude images, which return a blank
          // text element.
          if (elementText) {
            text.push(elementText);
          }
        }
      }
    }
  }
  if (!text.length) throw new Error('Please select some text.');
  return text;
}

/**
 * Replaces the text of the current selection with the provided text, or
 * inserts text at the current cursor location. (There will always be either
 * a selection or a cursor.) If multiple elements are selected, only inserts the
 * translated text in the first element that can contain text and removes the
 * other elements.
 *
 * @param {string} newText The text with which to replace the current selection.
 */
function insertText(newText) {
  const selection = DocumentApp.getActiveDocument().getSelection();
  if (selection) {
    let replaced = false;
    const elements = selection.getSelectedElements();
    if (elements.length === 1 && elements[0].getElement().getType() ===
      DocumentApp.ElementType.INLINE_IMAGE) {
      throw new Error('Can\'t insert text into an image.');
    }
    for (let i = 0; i < elements.length; ++i) {
      if (elements[i].isPartial()) {
        const element = elements[i].getElement().asText();
        const startIndex = elements[i].getStartOffset();
        const endIndex = elements[i].getEndOffsetInclusive();
        element.deleteText(startIndex, endIndex);
        if (!replaced) {
          element.insertText(startIndex, newText);
          replaced = true;
        } else {
          // This block handles a selection that ends with a partial element. We
          // want to copy this partial text to the previous element so we don't
          // have a line-break before the last partial.
          const parent = element.getParent();
          const remainingText = element.getText().substring(endIndex + 1);
          parent.getPreviousSibling().asText().appendText(remainingText);
          // We cannot remove the last paragraph of a doc. If this is the case,
          // just remove the text within the last paragraph instead.
          if (parent.getNextSibling()) {
            parent.removeFromParent();
          } else {
            element.removeFromParent();
          }
        }
      } else {
        const element = elements[i].getElement();
        if (!replaced && element.editAsText) {
          // Only translate elements that can be edited as text, removing other
          // elements.
          element.clear();
          element.asText().setText(newText);
          replaced = true;
        } else {
          // We cannot remove the last paragraph of a doc. If this is the case,
          // just clear the element.
          if (element.getNextSibling()) {
            element.removeFromParent();
          } else {
            element.clear();
          }
        }
      }
    }
  } else {
    const cursor = DocumentApp.getActiveDocument().getCursor();
    const surroundingText = cursor.getSurroundingText().getText();
    const surroundingTextOffset = cursor.getSurroundingTextOffset();

    // If the cursor follows or preceds a non-space character, insert a space
    // between the character and the translation. Otherwise, just insert the
    // translation.
    if (surroundingTextOffset > 0) {
      if (surroundingText.charAt(surroundingTextOffset - 1) !== ' ') {
        newText = ' ' + newText;
      }
    }
    if (surroundingTextOffset < surroundingText.length) {
      if (surroundingText.charAt(surroundingTextOffset) !== ' ') {
        newText += ' ';
      }
    }
    cursor.insertText(newText);
  }
}
